// What the emitters actually put on disk — asserted from the FILESYSTEM, never from a counted
// return value. Stream B (quartz replacement programme), file name approved as D-B-01 / D-23.
//
// THE CLASS THIS FILE EXISTS FOR
//
//   `static.ts` copies with `fs.cp(quartz/static -> output/static, {recursive:true, dereference:true})`
//   but REPORTS with `glob("**", staticPath, ignorePatterns)`, which honours `.gitignore`. In this
//   repository those two sets are wildly different: the glob sees the 9 tracked files, while the
//   copy moves 4,952 — the other 4,943 are the gitignored generated neural payload. So:
//
//     * a replacement that copies only what the glob reports takes `static/**` from 4,952 to 9,
//       and NO gate in the repo notices (`check_payload_budget.py` enforces maxima, so shrinking
//       always passes; `html_file_count` is recorded and never compared);
//     * and a counted emitter return therefore does NOT prove filesystem coverage
//       (INTERFACE.md §6). This file compares directory trees, not lengths.
//
//   The fixture reproduces that shape deliberately: a `.gitignore`d subtree inside the static
//   source, which the reporting glob cannot see and the copy must still move.
//
//   `assets.ts` is the mirror image. It emits ZERO files against the real corpus, so "no forbidden
//   file was copied" is satisfied by an emitter that copies nothing at all. The fixture gives it
//   real work to do, so the check has a positive floor: the capability is proven live (recon R9 —
//   deleting it deletes a capability), and the exclusions are proven to be exclusions rather than
//   emptiness. The one that matters is the dot DIRECTORY: `content/.obsidian/plugins/obsidian-git/
//   main.js` is a TRACKED 683,412-byte file (128 tracked files under `content/.obsidian`), and a
//   walker built on `rglob`, `os.walk`, `fast-glob {dot:true}` or `git ls-files` ships it to the
//   site root.
//
//   MEASURED, and it corrects recon R10: it is held out TWICE, not once. globby's `dot:false`
//   default excludes it, AND the `".obsidian"` entry in ignorePatterns excludes it — either alone
//   is sufficient (see the mutant note below for the experiment). R10 says "excluded by dot:false,
//   NOT by the `.obsidian` entry"; the "not" is wrong. What IS true, and is the reason this fixture
//   does not stop at `.obsidian`, is that only `dot:false` is GENERAL: the named entry protects one
//   directory, so the day a `.github` or `.vscode` appears under `content/`, `dot:false` is the
//   only thing standing between it and the site root.
//
// MUTANTS THAT MUST TURN THIS FILE RED (re-run after any change here):
//   - `static.ts`: copy the glob's results instead of `fs.cp`            … kills "whole directory"
//   - `static.ts`: `dereference: true` → `false`                         … kills "dereference"
//   - `util/glob.ts`: add `dot: true` to the globby options              … kills "dot directory"
//     (this one SURVIVED the first time it was run: the fixture held only `.obsidian`, which the
//      `".obsidian"` ignorePattern excludes independently. Measured with globby directly:
//      dot:false alone excludes it, and the ignorePattern alone excludes it — two independent
//      guards. So recon R10's "excluded by dot:false, NOT by the .obsidian entry" is wrong on the
//      "not"; both hold today, and only `dot:false` is general. The fixture now carries a dot
//      directory that is not in ignorePatterns.)
//   - `assets.ts`: drop `"**/*.md"` from `filesToCopy`'s ignore list     … kills "exclusions"
//   - `contentIndex.ts`: `.slice(0, limit-1)`, i.e. one fewer item        … kills "feed order"
//   - `contentIndex.ts`: `.slice(1, limit+1)`, i.e. a different ten       … kills "feed order"
//   - `contentIndex.ts`: reverse the date comparator                      … kills "feed order"
//   - `contentIndex.ts`: return -1 for equal dates (reverses ties)        … kills "feed order"
//     NON-KILL, and the direction matters: returning +1 for equal dates SURVIVES. V8 uses
//     insertion sort below ~22 elements, and a positive result for a tie means "leave it where
//     it is", so that mutant is a behavioural no-op on ties. Only the -1 direction actually
//     reorders them. A tie-mutant in the wrong direction proves nothing — use -1.
//   - `helpers.ts`: append `"\n"` to the written content                 … kills "byte-exact write"
//   - `helpers.ts`: return the path before awaiting `writeFile`          … kills "completed write"
//
// A CROSS-STREAM NOTE, learned the hard way at the first merge-down: every scenario here runs
// the probe with cwd = SOURCE_DIR, the real runtime base, NOT the temp fixture root. The two
// scenarios that need the fixture as cwd (Static, Assets) chdir to it inside the snippet instead.
// This is load-bearing since S1's loadGraphData fix: `renderPage` reads `<cwd>/../graph.json` and
// a missing file is now FATAL rather than silently caught, so any fixture that renders a page
// from a temp cwd throws "Cannot load required graph data". These four tests were green only
// because of the bare catch S1 was authorised to remove — the gate was right and the fixtures
// were free-riding on a defect.
//
// A TRAP FOR THE NEXT PERSON WHO PARSES THE FEED, because the defensive version is the wrong one:
// do NOT `.slice(1)` the <link> matches to "drop the channel link". The channel's own link is
// `https://bjjgraph.org` with NO trailing path, so a pattern requiring a slash after the host
// never matches it — and the slice then silently eats the first ITEM instead. Match item links
// with the trailing slash in the pattern and assert the channel link separately, as below. Found
// the hard way: the emitter was right, the spec-derived expectation was right, and the guard
// added to be safe was the only thing wrong.
//
// NON-KILLS — recorded so nobody reads this file as covering them:
//   - Nothing here asserts the PRODUCTION file counts. `static/**` is 4,952 in build0 only because
//     the gitignored neural payload happened to hold 4,943 files that day; a literal would pin the
//     payload's size, not Static's behaviour (D-20). Production coverage is set-equality against
//     V's artifact manifest, not a number in a unit test.
//   - `helpers.ts` keeps a module-global `createdDirs` Set that is never cleared. A second build in
//     the same process, or a directory removed between writes, will hit `ENOENT` because the mkdir
//     is skipped. That is inherited under D-03 and is UNGUARDED — this file does not assert it in
//     either direction, so that a later fix is not reported as a regression.
//   - Assets' interaction with a real `.gitignore` above the content root is not exercised; the
//     fixture lives in a temp directory on purpose, so globby's gitignore handling here is only
//     what a `.gitignore` inside the tree produces.

import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import zlib from "node:zlib"
import { probe, SOURCE_DIR } from "./_emitter_probe.mjs"

const q = (p) => JSON.stringify(path.join(SOURCE_DIR, p))

// The real content-side ignore patterns, copied from `source/quartz.config.ts`. Kept as a literal
// so that a change to the config does not silently change what this fixture proves.
const REAL_IGNORE_PATTERNS = [
  "private",
  ".obsidian",
  "CONTRIBUTING-*.md",
  "**/CONTRIBUTING*.md",
  "*.old",
  "*.bak.*",
  "TEMPLATE.*",
  "**/TEMPLATE.*",
  "**/!(bjj-graph).json",
]

// One bundle, driven against many fixtures through the environment.
//
// NOTE FOR ANYONE EDITING BELOW: this is a TEMPLATE LITERAL. A backtick or a ${...} inside it —
// including inside a COMMENT — terminates or interpolates the outer string, and the failure
// surfaces as a SyntaxError from the bundled output with a line number that points nowhere near
// the comment you wrote. Use plain quotes and string concatenation inside the snippet. Cost me
// three separate debugging rounds before I wrote this down.
const SNIPPET = `
import { Static } from ${q("quartz/plugins/emitters/static")}
import { Assets } from ${q("quartz/plugins/emitters/assets")}
import { AliasRedirects } from ${q("quartz/plugins/emitters/aliases")}
import { ContentIndex } from ${q("quartz/plugins/emitters/contentIndex")}
import { ComponentResources } from ${q("quartz/plugins/emitters/componentResources")}
import { FolderPage } from ${q("quartz/plugins/emitters/folderPage")}
import { TagPage } from ${q("quartz/plugins/emitters/tagPage")}
import { NotFoundPage } from ${q("quartz/plugins/emitters/404")}
import { ContentPage } from ${q("quartz/plugins/emitters/contentPage")}
import * as AllEmitters from ${q("quartz/plugins/emitters/index")}
import { emitContent } from ${q("quartz/processors/emit")}
import { snapshot as ledgerSnapshot, enabled as ledgerEnabled } from ${q("quartz/plugins/emitters/emitLedger")}
import { defaultProcessedContent } from ${q("quartz/plugins/vfile")}
import { resetRenderState } from ${q("quartz/components/renderPage")}
import realConfig from ${q("quartz.config")}
import { write } from ${q("quartz/plugins/emitters/helpers")}

import fs from "node:fs"
import path from "node:path"

const args = JSON.parse(process.env.BJJ_PROBE_ARGS)
const emptyResources = { css: [], js: [] }

const mkctx = (o) => ({
  buildId: "emitter-filesystem-probe",
  argv: {
    directory: o.directory ?? "content",
    output: o.output,
    verbose: false,
    serve: false,
    fastRebuild: false,
    port: 0,
    wsPort: 0,
  },
  cfg: {
    configuration: { ignorePatterns: o.ignorePatterns ?? [] },
    plugins: { transformers: [], filters: [], emitters: [] },
  },
  allSlugs: [],
})

const out = {}

if (args.kind === "static") {
  // static.ts resolves its source as joinSegments(QUARTZ, "static") — i.e. "quartz/static"
  // relative to the process cwd — so the fixture is entered rather than passed.
  process.chdir(args.root)
  out.returned = await Static().emit(mkctx(args), [], emptyResources)
}

if (args.kind === "assets") {
  process.chdir(args.root)
  out.returned = await Assets().emit(mkctx(args), [], emptyResources)
}

if (args.kind === "aliases") {
  // AliasRedirects reads only slug, filePath and frontmatter off each tuple, so the fixture is
  // plain page data rather than a parsed VFile. It is the REAL emitter and the REAL write().
  const content = args.pages.map((p) => [null, { data: p }])
  out.returned = await AliasRedirects().emit(mkctx(args), content, emptyResources)
}

if (args.kind === "contentindex") {
  // The real factory with the real configured options, and the real site configuration so that
  // baseUrl, locale and pageTitle are production's. Page data is synthetic because ContentIndex
  // reads only slug/frontmatter/text/links/description/dates off it — no AST, no render.
  const content = args.pages.map((p) => [
    null,
    { data: { ...p, dates: p.created ? { created: new Date(p.created), modified: new Date(p.created), published: new Date(p.created) } : undefined } },
  ])
  const ctx = mkctx(args)
  ctx.cfg.configuration = realConfig.configuration
  out.returned = await ContentIndex(args.options).emit(ctx, content, emptyResources)
  // Read back what the emitter left in memory-visible form: the RSS and sitemap are generated
  // BEFORE the emitter deletes description/date off the very objects it indexed, so the order of
  // those two steps is observable only in the emitted bytes.
  out.sitemap = fs.readFileSync(path.join(args.output, "sitemap.xml"), "utf8")
  out.rss = fs.readFileSync(path.join(args.output, "index.xml"), "utf8")
}

if (args.kind === "ledger") {
  // Drive the REAL emitContent with the REAL configured emitters into ONE output directory —
  // the production shape, including the concurrent phase two — and read the ledger afterwards.
  process.chdir(args.root)
  const content = args.pages.map((p) => defaultProcessedContent(p))
  const ctx = mkctx(args)
  ctx.cfg.configuration = realConfig.configuration
  ctx.cfg.plugins = { transformers: [], filters: [], emitters: realConfig.plugins.emitters }
  await emitContent(ctx, content)
  out.enabled = ledgerEnabled
  out.claims = ledgerSnapshot()
}

if (args.kind === "sole-registrant") {
  // Drive ComponentResources over the REAL configured emitter list, then over the same list with
  // one emitter removed. Whatever disappears from the bundles was registered by that emitter and
  // by nothing else.
  const build = async (output, exclude) => {
    const emitters = realConfig.plugins.emitters.filter((e) => e.name !== exclude)
    const ctx = mkctx({ ...args, output })
    ctx.cfg.configuration = realConfig.configuration
    ctx.cfg.plugins = { transformers: [], filters: [], emitters }
    await ComponentResources().emit(ctx, [], emptyResources)
    return {
      css: fs.readFileSync(path.join(output, "index.css"), "utf8"),
      post: fs.readFileSync(path.join(output, "postscript.js"), "utf8"),
      emitters: emitters.length,
    }
  }
  out.withAll = await build(args.outputA, null)
  out.without = await build(args.outputB, args.exclude)
}

if (args.kind === "componentresources") {
  // The real emitter, with a configuration whose env-guarded fields are SET. The golden build ran
  // keyless (POSTHOG_API_KEY and SUPABASE_URL both unset), so the keyed direction of both
  // injections cannot be observed anywhere in build0 — only a fixture can reach it.
  const ctx = mkctx(args)
  ctx.cfg.configuration = { ...realConfig.configuration, ...args.configuration }
  // Deliberately no emitters: the injections come from addGlobalPageResources, not from any
  // component, so an empty component set keeps this about the injection rather than the bundle.
  ctx.cfg.plugins = { transformers: [], filters: [], emitters: [] }
  const logs = []
  const realLog = console.log
  console.log = (...a) => logs.push(a.join(" "))
  try {
    out.returned = await ComponentResources().emit(ctx, [], emptyResources)
  } finally {
    console.log = realLog
  }
  out.logs = logs
  out.postscript = fs.readFileSync(path.join(args.output, "postscript.js"), "utf8")
  out.prescript = fs.readFileSync(path.join(args.output, "prescript.js"), "utf8")
  out.css = fs.readFileSync(path.join(args.output, "index.css"), "utf8")
}

if (args.kind === "folderpage") {
  // Real tuples via the real defaultProcessedContent, so the synthetic pages have exactly the
  // shape the emitter builds for itself (empty hast root, real VFile, only the data supplied).
  const content = args.pages.map((p) => defaultProcessedContent(p))
  const ctx = mkctx(args)
  ctx.cfg.configuration = realConfig.configuration
  ctx.cfg.plugins = { transformers: [], filters: [], emitters: [] }
  out.returned = await FolderPage().emit(ctx, content, emptyResources)
}

if (args.kind === "resourceorder") {
  // Fake emitters returning fake components, so the ORDER and DEDUP rules are observable without
  // pinning any real component's bytes — D is actively changing those, and a hash pin would go
  // red on their work rather than on a regression here.
  // PRODUCTION SHAPE, and it is the whole point of this fixture. Each emitter factory calls its
  // own HeaderConstructor()/BodyConstructor(), so the SAME component appears as DIFFERENT OBJECTS
  // carrying identical css - while quartz.layout.ts sharedPageComponents are constructed once and
  // are the same object everywhere. Both cases exist, so the fixture builds both: "shared" is one
  // object reused, everything else is a fresh object per sighting.
  const mk = (name, css) => Object.assign(() => null, { css, __name: name })
  const sharedInstances = {}
  const comp = (name) => {
    const css = args.components[name]
    if (name === "shared") return (sharedInstances[name] ||= mk(name, css))
    return mk(name, css)
  }
  const ctx = mkctx(args)
  ctx.cfg.configuration = realConfig.configuration
  ctx.cfg.plugins = {
    transformers: [],
    filters: [],
    emitters: args.emitterComponents.map((names, i) => ({
      name: "Fake" + i,
      getQuartzComponents: () => names.map((n) => comp(n)),
      emit: async () => [],
    })),
  }
  out.returned = await ComponentResources().emit(ctx, [], emptyResources)
  out.css = fs.readFileSync(path.join(args.output, "index.css"), "utf8")
}

if (args.kind === "contentpage") {
  const content = args.pages.map((p) => defaultProcessedContent(p))
  const ctx = mkctx(args)
  ctx.cfg.configuration = realConfig.configuration
  ctx.cfg.plugins = { transformers: [], filters: [], emitters: [] }
  const warnings = []
  const realWarn = console.log
  console.log = (...a) => warnings.push(a.join(" "))
  try {
    out.returned = await ContentPage().emit(ctx, content, emptyResources)
  } finally {
    console.log = realWarn
  }
  out.warnings = warnings
}

if (args.kind === "contentpage-shard") {
  const content = args.pages.map((p) => {
    const tuple = defaultProcessedContent(p)
    if (p.transcludes) {
      // A real block transclusion, hand-built as HAST. renderPage resolves the target through
      // componentData.slugMap and - critically - there is NO fallback when the map is PRESENT
      // and MISSES: renderPage.tsx:455 does an early return, silently dropping it. So a
      // shard that builds its slugMap from its OWN pages instead of the complete roster loses
      // every cross-shard transclusion without a word. This is what makes the roster load-bearing
      // rather than merely present, and it is the one thing the byte comparison could not see
      // until this page existed.
      tuple[0].children = [
        {
          type: "element",
          tagName: "blockquote",
          properties: { className: ["transclude"], dataBlock: "#^intro" },
          children: [
            {
              type: "element",
              tagName: "a",
              properties: { "data-slug": p.transcludes, href: "./" + p.transcludes },
              children: [],
            },
          ],
        },
      ]
    }
    if (p.providesBlock) {
      tuple[1].data.blocks = {
        intro: {
          type: "element",
          tagName: "p",
          properties: {},
          children: [{ type: "text", value: "TRANSCLUDED-MARKER-9f2a" }],
        },
      }
    }
    return tuple
  })
  const mk = (output) => {
    const c = mkctx({ ...args, output })
    c.cfg.configuration = realConfig.configuration
    c.cfg.plugins = { transformers: [], filters: [], emitters: [] }
    return c
  }
  const instance = ContentPage()
  const allFiles = content.map(([, file]) => file.data)

  // A: the ordinary 3-arg ABI over the whole corpus.
  const warnA = []
  let realLog = console.log
  console.log = (...a) => warnA.push(a.join(" "))
  try {
    // MIRROR THE DRIVER. emit.ts calls resetRenderState() before each phase and worker.ts before
    // each shard task, because renderPage memoises _rollPositionsJson — 18,759 bytes of EVERY
    // page in production — from the FIRST caller's allFiles. Without this the whole-corpus run
    // warms the memo and every shard inherits it, so the harness would be more forgiving than
    // production, which is a harness that certifies production defects.
    //
    // HONEST NOTE ON WHAT THIS DID AND DID NOT FIX: I added these two calls believing the memo
    // was why a narrowed-allFiles mutant survived. It was not — the mutant survived BOTH before
    // and after. The real cause was that the fixture had no roster-eligible pages at all
    // (the filter wants positions/ prefixed slugs ending /top or /bottom), so the roster was
    // empty either way and narrowing allFiles changed nothing. The Positions pages below are
    // the actual fix. These
    // resets stay because the driver does them and a divergent harness is its own hazard, but
    // they are not what kills that mutant.
    resetRenderState()
    out.returnedA = await instance.emit(mk(args.outputA), content, emptyResources)
  } finally {
    console.log = realLog
  }

  // B: the same corpus through emitShard, split into contiguous OWNED slices, every shard
  // receiving the COMPLETE ordered roster — which is what the driver does
  // (worker.ts slices content to renderCount; allFiles is the full corpus map).
  const size = Math.ceil(content.length / args.shards)
  out.warnB = []
  out.returnedB = []
  for (let i = 0, start = 0; start < content.length; i++, start += size) {
    const owned = content.slice(start, start + size)
    const w = []
    realLog = console.log
    console.log = (...a) => w.push(a.join(" "))
    try {
      resetRenderState()
      // The 5th argument is the shard index. It is ignored by an adapter that elects by value
      // and used by one that elects by index, so this gate drives BOTH without changing.
      out.returnedB.push(
        await instance.emitShard(mk(args.outputB), owned, emptyResources, allFiles, i),
      )
    } finally {
      console.log = realLog
    }
    out.warnB.push(w)
  }
  out.warnA = warnA
  out.customLayoutHasShard =
    ContentPage({ pageBody: instance.getQuartzComponents()[0] }).emitShard !== undefined
}

if (args.kind === "tagpage" || args.kind === "404") {
  const content = args.pages.map((p) => defaultProcessedContent(p))
  const ctx = mkctx(args)
  ctx.cfg.configuration = realConfig.configuration
  ctx.cfg.plugins = { transformers: [], filters: [], emitters: [] }
  const emitter = args.kind === "tagpage" ? TagPage() : NotFoundPage()
  out.returned = await emitter.emit(ctx, content, emptyResources)
}

if (args.kind === "write") {
  const ctx = mkctx(args)
  out.written = []
  for (const w of args.writes) {
    const content = w.base64 === undefined ? w.text : Buffer.from(w.base64, "base64")
    const before = Date.now()
    const fp = await write({ ctx, slug: w.slug, ext: w.ext, content })
    // Recorded at the moment the promise resolves: the ABI says an emitter resolves COMPLETED
    // writes, so the bytes must already be readable here, inside the probe, not later.
    let readableAtResolve = false
    let sizeAtResolve = -1
    try {
      const st = (await import("node:fs")).statSync(fp)
      readableAtResolve = true
      sizeAtResolve = st.size
    } catch {}
    out.written.push({ slug: w.slug, ext: w.ext, fp, readableAtResolve, sizeAtResolve, ms: Date.now() - before })
  }
}

console.log("__JSON__" + JSON.stringify(out))
`

function tmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  process.on("exit", () => fs.rmSync(d, { recursive: true, force: true }))
  return d
}

function put(root, rel, content) {
  const fp = path.join(root, rel)
  fs.mkdirSync(path.dirname(fp), { recursive: true })
  fs.writeFileSync(fp, content)
  return fp
}

/** Every regular file under `root`, relative and posix-separated, dotfiles included. */
function walk(root) {
  const out = []
  if (!fs.existsSync(root)) return out
  const rec = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, ent.name)
      if (ent.isDirectory()) rec(fp)
      else out.push(path.relative(root, fp).split(path.sep).join("/"))
    }
  }
  rec(root)
  return out.sort()
}

// ---------------------------------------------------------------------------------------------
// Static
// ---------------------------------------------------------------------------------------------

test("Static copies the WHOLE static directory, including what its own reporting glob cannot see", () => {
  const root = tmp("bjj-static-")
  const staticSrc = path.join(root, "quartz", "static")
  const output = path.join(root, "out")

  put(root, "outside.txt", "i live outside the static tree\n")
  put(staticSrc, "keep.txt", "tracked\n")
  put(staticSrc, "nested/deep.bin", Buffer.from([0, 1, 2, 3, 255]))
  put(staticSrc, "icon.png", Buffer.from("not really a png"))
  // The neural-payload analogue: a subtree the reporting glob cannot see, because `glob()` passes
  // `gitignore: true`. `fs.cp` has no idea .gitignore exists and must still move it.
  put(staticSrc, ".gitignore", "payload/\n")
  put(staticSrc, "payload/big.json", '{"generated":true}\n')
  put(staticSrc, "payload/app/bundle.js", "console.log(1)\n")
  fs.symlinkSync(path.join(root, "outside.txt"), path.join(staticSrc, "link.txt"))

  const { value } = probe(SNIPPET, {
    env: {
      BJJ_PROBE_ARGS: JSON.stringify({
        kind: "static",
        root,
        output,
        ignorePatterns: REAL_IGNORE_PATTERNS,
      }),
    },
  })

  const sourceFiles = walk(staticSrc)
  const copied = walk(path.join(output, "static"))

  assert.ok(sourceFiles.length > 0, "coverage floor: the fixture's static source tree was empty")
  assert.deepEqual(
    copied,
    sourceFiles,
    "output/static is not the same set of files as quartz/static — the copy is not whole-directory",
  )

  // Named explicitly, because this is the one the glob misses and the one that is 99.8% of the
  // real payload.
  assert.ok(
    copied.includes("payload/big.json") && copied.includes("payload/app/bundle.js"),
    "the gitignored subtree was not copied: Static is reporting-glob-shaped, not fs.cp-shaped",
  )

  // Bytes, not just names.
  let compared = 0
  for (const rel of sourceFiles) {
    const a = fs.readFileSync(path.join(staticSrc, rel))
    const b = fs.readFileSync(path.join(output, "static", rel))
    assert.deepEqual(b, a, `static/${rel} was copied with different bytes`)
    compared++
  }
  assert.ok(compared > 0, "coverage floor: zero files byte-compared")

  // dereference: true — the symlink must arrive as a real file.
  const linkStat = fs.lstatSync(path.join(output, "static", "link.txt"))
  assert.ok(
    !linkStat.isSymbolicLink(),
    "link.txt arrived as a symlink; `dereference: true` was lost and a host that does not follow links serves nothing",
  )
  assert.equal(
    fs.readFileSync(path.join(output, "static", "link.txt"), "utf8"),
    "i live outside the static tree\n",
  )

  // REPORTED, NOT ASSERTED: the emitter's return value under-reports the filesystem. Asserting the
  // gap would make a future honest return look like a regression; the gate above is the copy.
  const returned = value.returned ?? []
  console.log(
    `  [coverage] Static: ${compared} files byte-compared, ${copied.length} on disk, ` +
      `emitter returned ${returned.length} paths ` +
      `(${copied.length - returned.length} copied files the return value does not mention)`,
  )
  assert.ok(Array.isArray(returned), "Static.emit must resolve an array of FilePath")
})

// ---------------------------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------------------------

test("Assets copies non-markdown content and keeps the dot DIRECTORY out of the site root", () => {
  const root = tmp("bjj-assets-")
  const contentDir = path.join(root, "content")
  const output = path.join(root, "out")

  put(contentDir, "note.md", "# excluded by **/*.md\n")
  put(contentDir, "image.png", Buffer.from("png-bytes"))
  put(contentDir, "sub/photo.jpg", Buffer.from("jpg-bytes"))
  put(contentDir, "data.json", "{}\n") // excluded by **/!(bjj-graph).json
  put(contentDir, "bjj-graph.json", '{"kept":true}\n') // the one .json the pattern spares
  put(contentDir, "TEMPLATE.png", Buffer.from("template")) // excluded by TEMPLATE.*
  // The 683,412-byte tracked Obsidian plugin's analogue (128 tracked files under
  // `content/.obsidian` today). This one is held out TWICE — by globby's `dot:false` AND by the
  // `".obsidian"` ignorePattern — so on its own it cannot detect the loss of either guard.
  put(contentDir, ".obsidian/plugins/obsidian-git/main.js", "// 683KB in production\n")
  // These two are what actually gate `dot:false`, and they are the reason this fixture is not
  // just `.obsidian`: a dot directory that is NOT named in ignorePatterns, and a dot file. Today
  // `.obsidian` is the only dot directory under content/, so nothing in the corpus would notice
  // `dot:false` being lost — the next `.github` or `.vscode` would ship instead. Dropping these
  // two entries lets the `dot: true` mutant survive; it did, once, before they were added.
  put(contentDir, ".hidden/leak.js", "// any other dot directory\n")
  put(contentDir, ".dotfile.png", Buffer.from("dot file at the root"))

  const { value } = probe(SNIPPET, {
    env: {
      BJJ_PROBE_ARGS: JSON.stringify({
        kind: "assets",
        root,
        directory: contentDir,
        output,
        ignorePatterns: REAL_IGNORE_PATTERNS,
      }),
    },
  })

  const emitted = walk(output)

  // POSITIVE FLOOR FIRST: against the real corpus this emitter copies nothing, so an emitter that
  // copies nothing satisfies every exclusion trivially. The fixture gives it work; if it does none,
  // the capability is gone and this fails loudly rather than reporting clean.
  assert.ok(
    emitted.length > 0,
    "coverage floor: Assets copied ZERO files from a fixture that contains copyable assets — " +
      "the capability is gone (recon R9), or the emitter never ran",
  )

  assert.deepEqual(
    emitted,
    ["bjj-graph.json", "image.png", "sub/photo.jpg"],
    "Assets copied a different set than the ignore patterns predict",
  )

  // Named explicitly, because this is the one that ships 683 KB to the site root.
  assert.ok(
    !emitted.some((p) => p.includes("obsidian")),
    "the Obsidian plugin reached the output root",
  )
  const dotLeaks = emitted.filter((p) => p.split("/").some((seg) => seg.startsWith(".")))
  assert.deepEqual(
    dotLeaks,
    [],
    `dot entries reached the output root (${dotLeaks.join(", ")}); the walker lost globby's dot:false, ` +
      "and only `.obsidian` is separately named in ignorePatterns — every other dot directory ships",
  )

  const returned = value.returned ?? []
  assert.equal(
    returned.length,
    emitted.length,
    "Assets' return value and its filesystem output disagree — unlike Static, this emitter copies " +
      "exactly what it reports, and that equality is part of its contract",
  )
  console.log(
    `  [coverage] Assets: ${emitted.length} files copied, ${returned.length} returned; ` +
      `6 fixture inputs correctly excluded (note.md, data.json, TEMPLATE.png, .obsidian/**, ` +
      `.hidden/leak.js, .dotfile.png)`,
  )
})

// ---------------------------------------------------------------------------------------------
// helpers.write
// ---------------------------------------------------------------------------------------------

test("write() materialises exact bytes at output/slug+ext, and resolves only once they are on disk", () => {
  const root = tmp("bjj-write-")
  const output = path.join(root, "out")
  const gzBytes = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03])
  const text = '{"a":1}'

  const writes = [
    { slug: "static/contentIndex", ext: ".json", text },
    { slug: "static/contentIndex", ext: ".json.gz", base64: gzBytes.toString("base64") },
    { slug: "deeply/nested/never/seen/before/page", ext: ".html", text: "<!DOCTYPE html>" },
    { slug: "sitemap", ext: ".xml", text: "<urlset/>" },
    { slug: "no-extension-at-all", ext: "", text: "bare" },
  ]

  const { value } = probe(SNIPPET, {
    env: { BJJ_PROBE_ARGS: JSON.stringify({ kind: "write", output, writes }) },
  })

  let checked = 0
  for (const [i, w] of writes.entries()) {
    const rec = value.written[i]
    const expectedPath = path.join(output, w.slug + w.ext)
    assert.equal(
      path.resolve(rec.fp),
      path.resolve(expectedPath),
      `write() returned ${rec.fp}, expected ${expectedPath} (joinSegments(output, slug + ext))`,
    )
    assert.ok(
      rec.readableAtResolve,
      `write() resolved for ${w.slug}${w.ext} before the file was readable — the ABI promises a COMPLETED write`,
    )
    const onDisk = fs.readFileSync(expectedPath)
    const expected = w.base64 === undefined ? Buffer.from(w.text, "utf8") : Buffer.from(w.base64, "base64")
    assert.deepEqual(
      onDisk,
      expected,
      `write() altered the bytes of ${w.slug}${w.ext} — no wrapper, no trailing newline, no normalisation`,
    )
    assert.equal(rec.sizeAtResolve, expected.length, `size at resolve differed for ${w.slug}${w.ext}`)
    checked++
  }
  assert.ok(checked > 0, "coverage floor: zero writes checked")

  // Compound extension, named: contentIndex.json.gz is the only `.x.y` the build emits.
  assert.ok(
    fs.existsSync(path.join(output, "static", "contentIndex.json.gz")),
    "compound extension .json.gz did not survive write()",
  )
  console.log(
    `  [coverage] write(): ${checked} writes checked byte-for-byte, including one compound ` +
      `extension, one empty extension and one 5-level-deep new directory`,
  )
})

// ---------------------------------------------------------------------------------------------
// AliasRedirects
// ---------------------------------------------------------------------------------------------

// WHY THIS ONE 380-BYTE FILE IS LOAD-BEARING FAR BEYOND ITS SIZE (D-44, from stream A):
// `[[game-over]]` is used by 668 content files and is NOT resolved by `util/path.ts` at all —
// there is no `content/game-over.md`. Those 668 links work only because AliasRedirects
// materialises `game-over.html`. Change this emitter and 668 files' links break while A's
// wikilink gate stays green, because from path.ts's side nothing changed. The byte assertion
// below is currently the only thing standing between a reformat of that template literal and a
// site-wide broken link. Do not touch this emitter without telling quartz-cto and mgr-cl-1.
//
// The exact bytes of the one alias stub the corpus produces, lifted from
// golden/build0/game-over.html: 380 bytes, sha256 8cd80df6285b67031a64929f62cd8333c2c61d035a9e0dc7
// fe5b6ae6d2c151c4. The leading newline, the 12-space indentation and the unterminated trailing
// line are all IN the emitted file — they come from the template literal in `aliases.ts` — so any
// reformat of that literal silently changes the bytes this repo ships. Inlined rather than read
// from the golden tree so the gate runs anywhere the repo is checked out.
const GOLDEN_GAME_OVER_STUB =
  "\n            <!DOCTYPE html>" +
  "\n            <html lang=\"en-us\">" +
  "\n            <head>" +
  "\n            <title>Game-Over</title>" +
  '\n            <link rel="canonical" href="../Game-Over">' +
  '\n            <meta name="robots" content="noindex">' +
  '\n            <meta charset="utf-8">' +
  '\n            <meta http-equiv="refresh" content="0; url=../Game-Over">' +
  "\n            </head>" +
  "\n            </html>" +
  "\n            "

test("AliasRedirects reproduces the golden stub byte-for-byte, and covers the four branches the corpus never exercises", () => {
  const root = tmp("bjj-aliases-")
  const output = path.join(root, "out")
  const contentDir = path.join(root, "content")

  // One page per branch. Only the first has a witness in the real corpus: `content/Game Over.md`
  // is the ONLY file in 4,600 carrying aliases or permalink, so permalink support, the
  // trailing-slash rewrite and the directory prefix are contract (D-03) with no corpus evidence.
  // A whole-tree diff against build0 therefore cannot see them break — measured by the contract
  // pass: 5 of 10 one-line mutants of this emitter leave build0 byte-identical.
  const pages = [
    {
      slug: "Game-Over",
      filePath: path.join(contentDir, "Game Over.md"),
      frontmatter: { title: "Game Over", aliases: ["game-over"] },
    },
    {
      slug: "Deep/Nested/Page",
      filePath: path.join(contentDir, "Deep", "Nested", "Page.md"),
      frontmatter: { title: "Nested", aliases: ["sibling"] },
    },
    {
      slug: "Perma",
      filePath: path.join(contentDir, "Perma.md"),
      frontmatter: { title: "Perma", permalink: "vanity/url" },
    },
    {
      slug: "Slashy",
      filePath: path.join(contentDir, "Slashy.md"),
      frontmatter: { title: "Slashy", aliases: ["folder/"] },
    },
    {
      slug: "Multi",
      filePath: path.join(contentDir, "Multi.md"),
      frontmatter: { title: "Multi", aliases: ["one", "two"] },
    },
    {
      // permalink is declared `unknown` and AliasRedirects accepts ONLY strings. A number must
      // emit nothing rather than a file called "42.html".
      slug: "NotAString",
      filePath: path.join(contentDir, "NotAString.md"),
      frontmatter: { title: "NotAString", permalink: 42 },
    },
    {
      // The <title> and the canonical are `simplifySlug(slug)`, not the raw slug. The two differ
      // only when the slug ends in `/index`, which nothing in the corpus that carries an alias
      // does — so without this page the `simplifySlug` call is a no-op everywhere it is observed
      // and the mutant that deletes it survives. Measured: it did.
      slug: "Section/index",
      filePath: path.join(contentDir, "Section", "index.md"),
      frontmatter: { title: "Section", aliases: ["sec-alias"] },
    },
    {
      slug: "Plain",
      filePath: path.join(contentDir, "Plain.md"),
      frontmatter: { title: "Plain" },
    },
  ]

  const { value } = probe(SNIPPET, {
    env: {
      BJJ_PROBE_ARGS: JSON.stringify({ kind: "aliases", root, directory: contentDir, output, pages }),
    },
  })

  const emitted = walk(output)
  assert.ok(emitted.length > 0, "coverage floor: AliasRedirects emitted nothing from a fixture with six aliases")

  assert.deepEqual(
    emitted,
    [
      "Deep/Nested/sibling.html", // the alias is resolved relative to the aliasing FILE's directory
      "Section/sec-alias.html", // simplifySlug() strips the trailing /index from the TARGET
      "folder/index.html", // a trailing-slash alias becomes folder/index, not "folder/.html"
      "game-over.html", // the one case the real corpus witnesses
      "one.html", // two aliases on one page emit two stubs
      "two.html",
      "vanity/url.html", // a string permalink emits; the numeric one on NotAString does not
    ],
    "AliasRedirects emitted a different set than its branches predict",
  )

  // THE BYTE GATE: the real corpus case, reproduced exactly.
  const stub = fs.readFileSync(path.join(output, "game-over.html"), "utf8")
  assert.equal(
    stub,
    GOLDEN_GAME_OVER_STUB,
    "the alias stub no longer matches golden/build0/game-over.html byte-for-byte",
  )
  assert.equal(Buffer.byteLength(stub, "utf8"), 380, "the alias stub is no longer 380 bytes")

  // The redirect target climbs back out by the right number of levels. Note this repo's
  // `util/path.ts` patches `pathToRoot` to emit one extra `..` versus upstream Quartz — measured,
  // `pathToRoot("game-over") === ".."` where upstream gives "." — so the golden's `../Game-Over`
  // is only correct because of that local patch. An upstream `pathToRoot` emits `./Game-Over` and
  // a 378-byte stub, and the byte assertion above is what catches it.
  const nested = fs.readFileSync(path.join(output, "Deep", "Nested", "sibling.html"), "utf8")
  assert.match(
    nested,
    /href="\.\.\/\.\.\/\.\.\/Deep\/Nested\/Page"/,
    "the 3-deep alias did not climb back to the site root before naming its target",
  )
  assert.equal(
    (nested.match(/\.\.\//g) ?? []).length,
    6,
    "the nested stub no longer carries exactly two 3-level climbs (canonical + refresh)",
  )

  // The trailing-slash rewrite: `folder/` becomes `folder/index`, not a file literally named
  // `folder/.html`.
  assert.ok(fs.existsSync(path.join(output, "folder", "index.html")), "a trailing-slash alias did not become folder/index.html")

  // simplifySlug is applied to the target, so an /index page's stub names the FOLDER, never
  // `Section/index`. Deleting that call is invisible on every other page.
  const sec = fs.readFileSync(path.join(output, "Section", "sec-alias.html"), "utf8")
  assert.ok(
    !sec.includes("Section/index"),
    "the /index page's alias stub still names Section/index; simplifySlug() was lost on the target",
  )

  // A non-string permalink emits nothing at all.
  assert.ok(!emitted.some((p) => p.includes("42")), "a numeric permalink produced a file")

  const returned = value.returned ?? []
  assert.equal(returned.length, emitted.length, "AliasRedirects' return value and its output disagree")
  console.log(
    `  [coverage] AliasRedirects: ${emitted.length} stubs from ${pages.length} fixture pages ` +
      `(1 corpus-witnessed byte-exact, 4 branches with no corpus witness, 1 negative case)`,
  )
})

// ---------------------------------------------------------------------------------------------
// ContentIndex
// ---------------------------------------------------------------------------------------------

test("ContentIndex emits four artifacts, strips description/date from the JSON, truncates at 3,000, and generates RSS BEFORE that strip", () => {
  const root = tmp("bjj-contentindex-")
  const output = path.join(root, "out")

  // 12 pages so the rssLimit of 10 is exercised as a limit rather than as "everything".
  const pages = Array.from({ length: 12 }, (_, i) => ({
    slug: `Section/Page-${String(i).padStart(2, "0")}`,
    frontmatter: { title: `Page ${i}`, tags: i % 2 ? ["alpha"] : [] },
    // Page 0 is 4,000 characters: longer than the 3,000-char truncation, which exists to keep
    // contentIndex.json under Cloudflare Pages' 25 MB file limit. In production that truncation
    // is load-bearing — the file is 16.4 MB WITH it.
    text: i === 0 ? "x".repeat(4000) : `body of page ${i}`,
    links: i === 0 ? ["Section/Page-01"] : [],
    description: `description of page ${i}`,
    created: `2026-0${(i % 9) + 1}-01T00:00:00.000Z`,
  }))
  // A page whose slug sorts FIRST alphabetically but is inserted LAST. Without it the fixture's
  // insertion order IS alphabetical, so an EXPECTED_SITEMAP_ORDER literal would be green against
  // a `.sort()` mutant — a literal that agrees by construction (CLAUDE.md §6.3). Month 1 keeps it
  // out of the RSS top ten, so the feed assertions above are undisturbed.
  pages.push({
    slug: "Section/A-sorts-first",
    frontmatter: { title: "A sorts first", tags: [] },
    text: "body of the alphabetically-first page",
    links: [],
    description: "description of the alphabetically-first page",
    created: "2026-01-01T00:00:00.000Z",
  })
  // An EMPTY-TEXT page. `includeEmptyFiles` decides its MEMBERSHIP, and against the real corpus
  // that flag is exercised by exactly 2 of 4,600 entries (Game-Over and Tree) — the thinnest
  // exercise on this surface. Every other fixture page has text, so without this one the flag is
  // satisfied by the RIGHT operand of `includeEmptyFiles || (text && text !== "")` twelve times
  // out of twelve and deleting the flag entirely is a fixture no-op.
  pages.push({
    slug: "Section/Z-empty-text",
    frontmatter: { title: "Empty", tags: [] },
    text: "",
    links: [],
    description: "description of the empty page",
    created: "2026-01-01T00:00:00.000Z",
  })

  const { value } = probe(SNIPPET, {
    env: {
      BJJ_PROBE_ARGS: JSON.stringify({
        kind: "contentindex",
        root,
        output,
        pages,
        options: { enableSiteMap: true, enableRSS: true }, // exactly what quartz.config.ts passes
      }),
    },
  })

  const emitted = walk(output)
  assert.deepEqual(
    emitted,
    ["index.xml", "sitemap.xml", "static/contentIndex.json", "static/contentIndex.json.gz"],
    "ContentIndex emitted a different artifact set",
  )

  const idx = JSON.parse(fs.readFileSync(path.join(output, "static", "contentIndex.json"), "utf8"))
  const keys = Object.keys(idx)
  assert.equal(keys.length, pages.length, "one contentIndex entry per published page")

  // PER-ENTRY PROPERTY ORDER. Every entry is built by one object literal, so a swap of two lines
  // there rewrites all 16.4 MB of contentIndex.json and its 3.4 MB gzip. Measured on the golden:
  // the shape histogram is {"title,links,tags,content": 4600} — one shape, 4,600 of 4,600.
  let shapesChecked = 0
  for (const k of keys) {
    assert.deepEqual(
      Object.keys(idx[k]),
      ["title", "links", "tags", "content"],
      `contentIndex entry ${k} has a different property order`,
    )
    shapesChecked++
  }
  assert.ok(shapesChecked > 0, "coverage floor: no entry shapes checked")
  assert.ok(keys.length > 0, "coverage floor: contentIndex is empty")

  // description and date are DELETED from the JSON. They exist in the in-memory index only so the
  // RSS feed can use them; shipping them would grow the 16.4 MB file for no consumer.
  for (const k of keys) {
    assert.ok(!("description" in idx[k]), `${k} still carries description in contentIndex.json`)
    assert.ok(!("date" in idx[k]), `${k} still carries date in contentIndex.json`)
  }

  // …and the RSS, generated BEFORE that delete, still has both. This is the ordering dependence:
  // move the delete above generateRSSFeed and the feed silently loses every pubDate and
  // description while every other assertion here stays green.
  assert.match(value.rss, /<pubDate>[^<]+<\/pubDate>/, "RSS lost its pubDate — the strip ran before the feed")
  assert.match(value.rss, /<description>description of page/, "RSS lost its descriptions — the strip ran before the feed")

  assert.equal(
    idx["Section/Page-00"].content.length,
    3000,
    "the 3,000-character truncation is gone; contentIndex.json is the largest artifact the build emits",
  )

  const items = (value.rss.match(/<item>/g) ?? []).length
  assert.equal(items, 10, "rssLimit is 10; the feed carried a different number of items")

  // WHICH TEN, AND IN WHAT ORDER. Requested by V, and the division of labour is the point:
  // in production the feed's selection is genuinely nondeterministic, because the sort key is
  // `created`, which on this host is the source file's checkout mtime (D-71) — so the whole-emit
  // differ has to normalise the RSS set and therefore stops being evidence for selection and
  // order. In a FIXTURE the dates are ours, so both are fully determined and assertable. That is
  // D-51 exactly: where the differ cannot see it, the fixture is the gate.
  //
  // Derived from the spec, not copied from a run: `contentIndex.ts` sorts DESC by date, a tie
  // returns 0, `Array#sort` is stable so ties keep insertion order, then `.slice(0, 10)`. The
  // fixture's page i has month (i % 9) + 1, so months run 1..9 then 1,2,3 again — which puts two
  // TIE PAIRS inside the window on purpose (Page-02/Page-11 at month 3, Page-01/Page-10 at
  // month 2). Those pairs are what pin the stable-sort behaviour; a comparator that returns 0
  // hands the decision to insertion order, and that has bitten this repo before.
  const EXPECTED_FEED_ORDER = [
    "Section/Page-08", // month 9
    "Section/Page-07",
    "Section/Page-06",
    "Section/Page-05",
    "Section/Page-04",
    "Section/Page-03",
    "Section/Page-02", // month 3, first of the tie pair by insertion order
    "Section/Page-11", // month 3, second
    "Section/Page-01", // month 2, first of the tie pair
    "Section/Page-10", // month 2, second — Page-00 and Page-09 (month 1) fall outside the ten
  ]
  // The channel's own <link> is `https://bjjgraph.org` with no trailing path, so this pattern —
  // which requires a slash after the host — matches item links only. (It is worth saying because
  // the obvious defensive `.slice(1)` to "drop the channel link" silently ate the first ITEM.)
  const feedLinks = [...value.rss.matchAll(/<link>https:\/\/bjjgraph\.org\/([^<]*)<\/link>/g)].map(
    (m) => m[1],
  )
  assert.match(value.rss, /<link>https:\/\/bjjgraph\.org<\/link>/, "the channel link is missing")
  assert.deepEqual(
    feedLinks,
    EXPECTED_FEED_ORDER,
    "the RSS feed selected a different set of items, or the same set in a different order",
  )
  assert.equal(
    new Set(feedLinks).size,
    feedLinks.length,
    "the feed repeated an item",
  )
  const locs = (value.sitemap.match(/<loc>/g) ?? []).length
  assert.equal(locs, pages.length, "the sitemap must carry every indexed page, not the RSS subset")

  // SITEMAP ORDER. The <url> order is the Map's insertion order, i.e. content order, and on the
  // golden it matches contentIndex.json's key order exactly (minus the 2 the post-processor
  // removes) and is NOT alphabetical. `Section/A-sorts-first` is inserted last, so this literal
  // distinguishes insertion order from a `.sort()`.
  const sitemapSlugs = [...value.sitemap.matchAll(/<loc>https:\/\/bjjgraph\.org\/([^<]*)<\/loc>/g)].map(
    (m) => m[1],
  )
  assert.deepEqual(
    sitemapSlugs,
    pages.map((p) => p.slug),
    "the sitemap's <url> order is no longer the index's insertion order",
  )
  assert.notDeepEqual(
    sitemapSlugs,
    [...sitemapSlugs].sort(),
    "the fixture's insertion order is alphabetical, so the assertion above cannot distinguish " +
      "insertion order from a sort — the control page was lost",
  )

  // EVERY <loc> CARRIES A <lastmod>. This is the assertion that catches the strip-before-generate
  // reorder: with `content.date` deleted, `${content.date && `<lastmod>…`}` guards the WHOLE
  // element, so a falsy date emits a BARE WORD where the element should be and the count drops.
  // (Do not assert on the literal: it renders "undefined", not "false", and the golden contains
  // neither — a `!includes("false")` check is green against the very mutant it names.)
  const lastmods = (value.sitemap.match(/<lastmod>/g) ?? []).length
  assert.equal(lastmods, locs, "a <loc> lost its <lastmod>; the date was stripped before the sitemap was generated")

  // The gzip is a real gzip OF THE JUST-WRITTEN JSON, and it is deterministic: node's zlib writes
  // MTIME=0 into the header, which is why two builds of identical source produce identical bytes.
  const jsonBytes = fs.readFileSync(path.join(output, "static", "contentIndex.json"))
  const gzBytes = fs.readFileSync(path.join(output, "static", "contentIndex.json.gz"))
  assert.deepEqual(
    zlib.gunzipSync(gzBytes),
    jsonBytes,
    "contentIndex.json.gz does not decompress to contentIndex.json",
  )
  assert.equal(gzBytes.readUInt32LE(4), 0, "the gzip header carries a non-zero MTIME; the .gz is no longer reproducible")

  // THE FLAG IS READ, not merely defaulted past. The run above uses production's options, where
  // includeEmptyFiles defaults true and the empty page IS indexed. This second run flips only
  // that flag and the empty page must vanish — which is what distinguishes "the option is
  // honoured" from "the option is present and inert".
  const outputNoEmpty = path.join(root, "out-no-empty")
  const { value: noEmpty } = probe(SNIPPET, {
    env: {
      BJJ_PROBE_ARGS: JSON.stringify({
        kind: "contentindex",
        root,
        output: outputNoEmpty,
        pages,
        options: { enableSiteMap: true, enableRSS: true, includeEmptyFiles: false },
      }),
    },
  })
  void noEmpty
  const idxNoEmpty = JSON.parse(
    fs.readFileSync(path.join(outputNoEmpty, "static", "contentIndex.json"), "utf8"),
  )
  assert.ok(
    "Section/Z-empty-text" in idx,
    "the empty-text page is missing from the DEFAULT index; includeEmptyFiles defaults true",
  )
  assert.ok(
    !("Section/Z-empty-text" in idxNoEmpty),
    "includeEmptyFiles:false still indexed the empty-text page — the flag is not being read",
  )
  assert.equal(
    Object.keys(idxNoEmpty).length,
    pages.length - 1,
    "includeEmptyFiles:false removed a different number of pages than the one empty page",
  )

  console.log(
    `  [coverage] ContentIndex: 4 artifacts, ${keys.length} index entries all stripped of ` +
      `description+date, ${items} RSS items from ${pages.length} pages, ${locs} sitemap locs, ` +
      `1 truncation at 3,000 chars, gzip MTIME=0, ${feedLinks.length} feed links pinned in order ` +
      `(2 tie pairs inside the window), ${sitemapSlugs.length} sitemap slugs pinned in insertion ` +
      `order, ${lastmods} lastmods, ${shapesChecked} entry shapes, includeEmptyFiles proven read ` +
      `in both directions`,
  )
})

// ---------------------------------------------------------------------------------------------
// ComponentResources — the two env-guarded injections
// ---------------------------------------------------------------------------------------------

// Both the PostHog block and the Supabase block are guarded on a value that comes from the
// environment: `cfg.analytics.apiKey` (from `POSTHOG_API_KEY || ""`) and `cfg.supabase?.url`
// (from `SUPABASE_URL || ""`). **The golden build ran with both unset**, so build0's postscript.js
// contains NEITHER, and no golden-tree comparison can ever assert that the keyed direction still
// works. That is the hole this test fills, and it is why the fixture supplies the CONFIG and then
// asserts the emitter's OUTPUT — never the other way round.
//
// The distinction matters concretely. `e2e/journeys/auth-redirect-back.spec.ts` gates the
// Supabase LOGIC, but it installs `window.__SUPABASE_URL` itself via `addInitScript`, so a
// replacement that stops EMITTING the injection leaves that spec green (D-40).
// `tests/analytics_surface_gate.test.mjs` pins the PostHog snippet as a verbatim substring of
// this emitter's SOURCE and runs the real python gate over a synthetic build output — it never
// executes the emitter. Neither covers "did the emitter put these bytes in postscript.js".
//
// NON-KILL, recorded: this drives ComponentResources with an EMPTY emitter list, so it asserts
// nothing about component CSS/JS ordering or bundle bytes. Resource order is byte-significant and
// is not covered here.

const PH_STUB = "(window.posthog=e,e._i=[],e.init=function("
const PH_LOADER = '.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js"'

function runComponentResources(configuration, label) {
  const root = tmp(`bjj-cr-${label}-`)
  const output = path.join(root, "out")
  const { value } = probe(SNIPPET, {
    env: {
      BJJ_PROBE_ARGS: JSON.stringify({ kind: "componentresources", root, output, configuration }),
    },
  })
  return { ...value, output }
}

test("ComponentResources EMITS the PostHog and Supabase injections when the env supplies them", () => {
  const r = runComponentResources(
    {
      analytics: {
        provider: "posthog",
        apiKey: "phc_FIXTUREKEY",
        host: "https://us.i.posthog.com",
        uiHost: "https://us.i.posthog.com",
      },
      supabase: { url: "https://fixture.supabase.co", anonKey: "anon_FIXTUREKEY" },
    },
    "keyed",
  )

  let checked = 0
  for (const needle of [
    PH_STUB,
    PH_LOADER,
    'posthog.init("phc_FIXTUREKEY"',
    "__SUPABASE_URL",
    "https://fixture.supabase.co",
    "__SUPABASE_ANON_KEY",
    "anon_FIXTUREKEY",
  ]) {
    assert.ok(
      r.postscript.includes(needle),
      `postscript.js does not contain ${JSON.stringify(needle)} — the emitter stopped emitting it`,
    )
    checked++
  }
  assert.ok(checked > 0, "coverage floor: nothing was checked against the emitted bundle")
  assert.ok(r.postscript.length > 0, "coverage floor: postscript.js is empty")
  console.log(
    `  [coverage] ComponentResources keyed: ${checked} emitted substrings confirmed in a ` +
      `${r.postscript.length}-byte postscript.js`,
  )
})

test("ComponentResources emits NEITHER injection without the env, and SAYS SO", () => {
  const r = runComponentResources(
    {
      analytics: { provider: "posthog", apiKey: "", host: undefined, uiHost: "https://us.i.posthog.com" },
      supabase: { url: "", anonKey: "" },
    },
    "keyless",
  )

  let checked = 0
  for (const needle of [PH_STUB, PH_LOADER, "posthog.init(", "__SUPABASE_URL", "__SUPABASE_ANON_KEY"]) {
    assert.ok(
      !r.postscript.includes(needle),
      `keyless postscript.js still contains ${JSON.stringify(needle)}`,
    )
    checked++
  }

  // THE SKIP PRINTS. Without this line, "no analytics in the bundle" and "analytics silently
  // misconfigured in CI" produce identical build output — the defect class this repo has hit
  // seventeen times. The emitter already does it; this makes removing it a red test.
  assert.ok(
    r.logs.some((l) => l.includes("PostHog disabled") && l.includes("POSTHOG_API_KEY")),
    `the keyless build did not print the PostHog skip line. Logs: ${JSON.stringify(r.logs)}`,
  )

  // …and the emitter still ran: the absence must be an absence of the INJECTION, not of the
  // emitter. postscript.js is non-empty even keyless because the SPA router and the nav event go
  // in unconditionally. prescript.js IS empty here and that is the fixture's doing, not a defect —
  // beforeDOMLoaded content comes from components, and this fixture deliberately has none.
  assert.ok(r.postscript.length > 0, "coverage floor: keyless postscript.js is empty")
  assert.deepEqual(
    walk(r.output).sort(),
    ["index.css", "postscript.js", "prescript.js"],
    "ComponentResources must emit all three bundle files even when a bundle has no content",
  )
  console.log(
    `  [coverage] ComponentResources keyless: ${checked} substrings confirmed ABSENT from a ` +
      `${r.postscript.length}-byte postscript.js, and the skip line printed`,
  )
})

// ---------------------------------------------------------------------------------------------
// FolderPage — the 1,518 duplicates and the identity split that makes them duplicates
// ---------------------------------------------------------------------------------------------

// FolderPage emits 1,525 pages in production: 1,518 that duplicate a flat `<dir>.html` sibling and
// 7 pure ones under `Submissions/`. Both are live at 200 with no redirect (D-04) and both are
// inherited exactly under D-03 — retiring them is a post-cutover decision.
//
// THE MECHANISM, and it is one line of it that matters: when an authored page's simplified slug
// equals a folder name, that page's tuple REPLACES the folder's synthetic one, so the folder page
// renders the content page's own data — but it is WRITTEN at `<folder>/index` while
// `file.data.slug` keeps the authored `<folder>`. Two identities, deliberately not normalised
// together. That is why the duplicate's `<head>` is byte-identical to the flat page's, canonical
// included: measured on 40 random pairs from build0, 40 of 40 identical heads (the BODIES differ —
// the folder copy renders FolderContent, and is ~10 kB smaller).
//
// Normalise the two identities and every duplicate starts self-canonicalising to `/X/index`,
// which is a URL the site does not serve. Nothing in the repo gates that today: recon §2.1 records
// FolderPage as UNGATED, and 0 of check_seo_parity.py's sample routes is an index.html.
//
// NON-KILL, recorded: this asserts the identity split and the folder SET, not the rendered body.
// FolderContent's listing, its sort order and the 7 pure pages' zero-character <article> are not
// covered here.

test("FolderPage mints one index per folder, and keeps the authored slug on a page written at folder/index", () => {
  const root = tmp("bjj-folderpage-")
  const output = path.join(root, "out")

  const pages = [
    // A child page mints folder "A"…
    { slug: "A/Child", frontmatter: { title: "A Child", tags: [] } },
    // …and this authored page, whose simplified slug IS "A", replaces the folder's default tuple.
    { slug: "A", frontmatter: { title: "The Authored A Page", tags: [] } },
    // "C" gets no authored page, so it stays synthetic: the `Folder: C` title.
    { slug: "C/Child", frontmatter: { title: "C Child", tags: [] } },
    // Nested folders are minted at every level that is a dirname.
    { slug: "D/E/Leaf", frontmatter: { title: "Leaf", tags: [] } },
    // A root-level page contributes dirname "." and must mint nothing.
    { slug: "Root", frontmatter: { title: "Root", tags: [] } },
    // "tags" is excluded by name — TagPage owns it.
    { slug: "tags/alpha", frontmatter: { title: "alpha", tags: [] } },
  ]

  const { value } = probe(SNIPPET, {
    env: { BJJ_PROBE_ARGS: JSON.stringify({ kind: "folderpage", root, output, pages }) },
  })

  const emitted = walk(output)
  assert.ok(emitted.length > 0, "coverage floor: FolderPage emitted nothing")
  assert.deepEqual(
    emitted,
    ["A/index.html", "C/index.html", "D/E/index.html"],
    "FolderPage minted a different folder set — note that '.' and 'tags' must mint nothing, and " +
      "that only the immediate dirname is a folder (D/E, not D)",
  )

  const a = fs.readFileSync(path.join(output, "A", "index.html"), "utf8")
  const c = fs.readFileSync(path.join(output, "C", "index.html"), "utf8")

  // THE IDENTITY SPLIT. The file is at A/index.html; the page still calls itself /A.
  assert.match(
    a,
    /<link rel="canonical" href="https:\/\/bjjgraph\.org\/A"\/>/,
    "A/index.html no longer canonicalises to /A — the render slug and file.data.slug were " +
      "normalised together, and every one of the 1,518 duplicates now points at a URL the site " +
      "does not serve",
  )
  assert.ok(
    !a.includes("bjjgraph.org/A/index"),
    "A/index.html canonicalises to /A/index somewhere; the authored slug was overwritten",
  )

  // The authored page replaced the synthetic tuple: its title, not "Folder: A".
  assert.ok(a.includes("The Authored A Page"), "the authored page did not replace the folder's default tuple")
  assert.ok(!a.includes("Folder: A"), "A/index.html still carries the synthetic folder title")

  // …and a folder with no authored page keeps the synthetic i18n title.
  assert.ok(c.includes("Folder: C"), "the pure folder page lost its synthetic 'Folder: C' title")

  const returned = value.returned ?? []
  assert.equal(returned.length, emitted.length, "FolderPage's return value and its output disagree")
  console.log(
    `  [coverage] FolderPage: ${emitted.length} folder indexes from ${pages.length} pages ` +
      `(1 authored-replacement, 1 pure synthetic, 1 nested; '.' and 'tags' correctly minted none)`,
  )
})

// ---------------------------------------------------------------------------------------------
// TagPage
// ---------------------------------------------------------------------------------------------

// 11 pages in production: 10 tags plus `tags/index.html`. UNGATED before this (recon §2.1).
// The 11 ship indexable zero-character <article>s with no `meta robots` — the same soft-404 shape
// Head.tsx documents as deliberately fixed for /Game-Over (recon R6). Inherited under D-03; this
// test pins the SET and the minting rules, and asserts nothing about that emptiness in either
// direction so that fixing it later is not reported as a regression.

test("TagPage mints a page per tag plus the index, expanding nested tags to every prefix", () => {
  const root = tmp("bjj-tagpage-")
  const output = path.join(root, "out")

  const pages = [
    { slug: "P1", frontmatter: { title: "P1", tags: ["alpha"] } },
    // A nested tag mints EVERY prefix: "beta" and "beta/deep", not just the leaf.
    { slug: "P2", frontmatter: { title: "P2", tags: ["beta/deep"] } },
    { slug: "P3", frontmatter: { title: "P3", tags: ["alpha", "gamma"] } },
    { slug: "P4", frontmatter: { title: "P4", tags: [] } },
    // An authored tags/ page replaces the synthetic tuple for that tag.
    { slug: "tags/alpha", frontmatter: { title: "The Authored Alpha Tag", tags: [] } },
  ]

  const { value } = probe(SNIPPET, {
    env: { BJJ_PROBE_ARGS: JSON.stringify({ kind: "tagpage", root, output, pages }) },
  })

  const emitted = walk(output)
  assert.ok(emitted.length > 0, "coverage floor: TagPage emitted nothing")
  assert.deepEqual(
    emitted,
    [
      "tags/alpha.html",
      "tags/beta.html", // minted by the PREFIX of beta/deep, though nothing is tagged plain "beta"
      "tags/beta/deep.html",
      "tags/gamma.html",
      "tags/index.html", // always minted, by tags.add("index")
    ],
    "TagPage minted a different tag set",
  )

  const alpha = fs.readFileSync(path.join(output, "tags", "alpha.html"), "utf8")
  assert.ok(
    alpha.includes("The Authored Alpha Tag"),
    "the authored tags/alpha page did not replace the synthetic tuple",
  )
  const gamma = fs.readFileSync(path.join(output, "tags", "gamma.html"), "utf8")
  assert.ok(gamma.includes("gamma"), "the synthetic tag page lost its tag title")

  const returned = value.returned ?? []
  assert.equal(returned.length, emitted.length, "TagPage's return value and its output disagree")
  console.log(
    `  [coverage] TagPage: ${emitted.length} pages from ${pages.length} sources ` +
      `(1 nested tag expanded to 2 prefixes, 1 authored replacement, 1 always-minted index)`,
  )
})

// ---------------------------------------------------------------------------------------------
// 404Page
// ---------------------------------------------------------------------------------------------

// One file, 27,233 bytes in build0, UNGATED (recon §2.1) and carrying no byte ceiling anywhere —
// `budget_site.json`'s `pages` block has nine keys and none of them is 404.html.
//
// THE THING A REPLACEMENT GETS WRONG BY DEFAULT: this page alone computes its resource base from
// `new URL("https://" + baseUrl).pathname`, i.e. "/", NOT from `pathToRoot(slug)`. So its
// stylesheet and script URLs are ROOT-ABSOLUTE while CategoryNav on the very same page uses
// `pathToRoot("404")` = ".." for its links. The page deliberately mixes two bases — it has to,
// because a 404 is served from an arbitrary depth — and D-03 requires reproducing that exactly.
// Switching it to pathToRoot is a 10-byte change that looks like a tidy-up.

test("404Page emits one file whose RESOURCE base is root-absolute while its nav base is relative", () => {
  const root = tmp("bjj-404-")
  const output = path.join(root, "out")
  const pages = [
    { slug: "Positions/Mount", frontmatter: { title: "Mount", tags: [] } },
    { slug: "Learning/Intro", frontmatter: { title: "Intro", tags: [] } },
  ]

  const { value } = probe(SNIPPET, {
    env: { BJJ_PROBE_ARGS: JSON.stringify({ kind: "404", root, output, pages }) },
  })

  const emitted = walk(output)
  assert.deepEqual(emitted, ["404.html"], "404Page must emit exactly one file, at the output root")

  const html = fs.readFileSync(path.join(output, "404.html"), "utf8")
  assert.ok(html.length > 0, "coverage floor: 404.html is empty")

  let rootAbsolute = 0
  for (const asset of ["/index.css", "/prescript.js", "/postscript.js"]) {
    assert.ok(
      html.includes(`"${asset}"`),
      `404.html no longer loads ${asset} root-absolutely — the resource base was switched to ` +
        `pathToRoot, which is a one-line tidy-up that breaks a 404 served from any depth`,
    )
    rootAbsolute++
  }
  assert.ok(
    !html.includes('"../index.css"'),
    "404.html is loading ../index.css; the root-absolute resource base is gone",
  )

  // …and the nav on the same page is relative, which is the mismatch worth pinning as deliberate.
  const relativeNav = (html.match(/href="\.\.\/[A-Z]/g) ?? []).length
  assert.ok(
    relativeNav > 0,
    "404.html has no ../ nav links; both bases became the same, which is not what production ships",
  )

  const returned = value.returned ?? []
  assert.equal(returned.length, 1, "404Page must resolve exactly one written path")
  console.log(
    `  [coverage] 404Page: 1 file, ${rootAbsolute} root-absolute resource URLs alongside ` +
      `${relativeNav} depth-relative nav links — two bases on one page, deliberately`,
  )
})

// ---------------------------------------------------------------------------------------------
// ContentPage
// ---------------------------------------------------------------------------------------------

// 4,600 pages: 74.8% of everything the build emits. It carries two project-authored
// optimisations that are NOT upstream — a slugMap built once for transclusion lookups, and writes
// flushed in batches of 64 — and the batching is the interesting one, because a lost final flush
// drops every page after the last full batch and NOTHING IN THE REPO NOTICES: every figure in
// check_payload_budget.py is a MAX, so shrinking always passes, and `html_file_count` is recorded
// and never compared (recon §2.1 calls this the worst blind spot in the repo). The fixture
// therefore uses a page count that is deliberately NOT a multiple of 64.
//
// NON-KILLS, recorded:
//   - Dropping `slugMap` from the props is byte-invisible: renderPage falls back to
//     `allFiles.find`, which resolves the same page data. It is an O(n)→O(1) optimisation, not a
//     behaviour, and no assertion here can distinguish it. MEASURED: that mutant was run and it
//     SURVIVED, as predicted. Recorded rather than papered over — the right response is not a
//     stricter assertion, because an assertion that failed on it would be asserting a
//     performance choice as though it were output.
//   - This asserts the page SET, the resource base, the batching and the case-variant pairs. It
//     does not assert rendered body bytes; per-page byte parity is the render seam's job.

test("ContentPage writes every page including the partial final batch, at pathToRoot resources", () => {
  const root = tmp("bjj-contentpage-")
  const output = path.join(root, "out")

  // 70 pages: one full batch of 64 plus a remainder of 6. If the final flush is lost, exactly
  // those 6 vanish and every existing gate in the repo still passes.
  const pages = Array.from({ length: 70 }, (_, i) => ({
    slug: `Section/Page-${String(i).padStart(2, "0")}`,
    frontmatter: { title: `Page ${i}`, tags: [] },
  }))
  // The 9 case-variant pairs in build0 are distinct indexable URLs with identical content on a
  // case-sensitive host (recon R6). Inherited under D-03 — both must still be emitted.
  pages.push({ slug: "Positions/X-Guard/Top", frontmatter: { title: "X-Guard Top", tags: [] } })
  pages.push({ slug: "Positions/X-Guard/top", frontmatter: { title: "X-Guard top", tags: [] } })

  const { value } = probe(SNIPPET, {
    env: { BJJ_PROBE_ARGS: JSON.stringify({ kind: "contentpage", root, output, pages }) },
  })

  const emitted = walk(output)
  assert.ok(emitted.length > 0, "coverage floor: ContentPage emitted nothing")
  assert.equal(
    emitted.length,
    pages.length,
    `ContentPage wrote ${emitted.length} of ${pages.length} pages. If the shortfall is 6, the ` +
      `final partial batch was never flushed — and no payload, SEO or byte gate in this repo ` +
      `would have caught it, because every one of them is a maximum`,
  )
  assert.deepEqual(
    emitted.slice().sort(),
    pages.map((p) => `${p.slug}.html`).sort(),
    "ContentPage emitted a different page set",
  )

  // Case-variant pair: two distinct files, not one overwriting the other.
  assert.ok(
    emitted.includes("Positions/X-Guard/Top.html") && emitted.includes("Positions/X-Guard/top.html"),
    "the case-variant pair collapsed to one file; the build host is case-sensitive and build0 ships both",
  )

  // Resources are page-relative here — the opposite of 404Page's root-absolute base, and the
  // reason both are pinned: a replacement that unifies them breaks one of the two.
  const deep = fs.readFileSync(path.join(output, "Positions", "X-Guard", "Top.html"), "utf8")
  assert.ok(
    deep.includes('"../../../index.css"'),
    "a 3-deep content page no longer loads ../../../index.css; the pathToRoot resource base is gone",
  )
  assert.ok(!deep.includes('"/index.css"'), "a content page is loading /index.css root-absolutely")

  // The missing-index warning is a real signal, not decoration: no page here has the slug
  // `index`, so it must fire.
  assert.ok(
    value.warnings.some((w) => w.includes("index.md")),
    `ContentPage did not warn about the missing index page. Logs: ${JSON.stringify(value.warnings).slice(0, 300)}`,
  )

  const returned = value.returned ?? []
  assert.equal(returned.length, emitted.length, "ContentPage's return value and its output disagree")
  console.log(
    `  [coverage] ContentPage: ${emitted.length} pages written (${Math.floor(pages.length / 64)} ` +
      `full batch of 64 + ${pages.length % 64} in the final flush), 1 case-variant pair kept ` +
      `distinct, resources page-relative`,
  )
})

// ---------------------------------------------------------------------------------------------
// ComponentResources — first-seen order and dedup across getQuartzComponents
// ---------------------------------------------------------------------------------------------

// "Resource order is byte-significant" is stated in INTERFACE.md §4 and §5 and is not gated
// anywhere. It is the rule that decides index.css and postscript.js byte-for-byte: components are
// collected by walking EVERY configured emitter's getQuartzComponents in configured order and
// adding them to a Set, so a component reached by two emitters contributes ONCE, at the position
// of its FIRST appearance.
//
// This asserts the PROPERTY with fake components rather than pinning real bytes. A hash of the
// real index.css would be red every time stream D touches a stylesheet, which is their job — the
// thing that must not change is the rule, not today's output of it.
//
// DECLARED NON-KILL, and it took three mutants to understand rather than one:
// replacing the component-identity `Set<QuartzComponent>` with a plain array — i.e. removing the
// first dedup layer entirely — leaves this test GREEN, and that is correct. There are TWO dedup
// layers and only the second is observable: `componentResources.css` / `.beforeDOMLoaded` /
// `.afterDOMLoaded` are `Set<string>`, so identical css dedups by VALUE no matter how many times
// its component is collected. Removing THAT layer does turn this red (mutant RO4).
//
// The identity Set is in fact near-useless in production, which is the part worth writing down:
// every emitter factory calls its OWN `HeaderConstructor()` / `BodyConstructor()`, so "the Header
// component" is a DIFFERENT OBJECT in ContentPage and in FolderPage and the identity Set never
// matches them. It only ever dedups `quartz.layout.ts`'s `sharedPageComponents` singletons — which
// the string Set would dedup anyway. The fixture reproduces both shapes deliberately ("shared" is
// one reused object, "gamma" is two distinct objects with identical css) so the claim rests on the
// layer that actually does the work.

test("ComponentResources collects components in first-seen order across emitters, once each", () => {
  const root = tmp("bjj-resorder-")
  const output = path.join(root, "out")

  const components = {
    shared: ".ord-shared{color:#101010}", // one object, reused — the sharedPageComponents case
    beta: ".ord-beta{color:#202020}",
    gamma: ".ord-gamma{color:#303030}", // fresh object per sighting — the HeaderConstructor case
    delta: ".ord-delta{color:#404040}",
  }
  // `shared` is sighted by all three emitters as ONE object; `gamma` by two emitters as TWO
  // DISTINCT objects with identical css. Both must appear exactly once, at the position of their
  // first sighting: emitter 0 for shared, emitter 1 for gamma.
  const emitterComponents = [
    ["shared", "beta"],
    ["gamma", "shared"],
    ["shared", "delta", "gamma"],
  ]

  const { value } = probe(SNIPPET, {
    env: {
      BJJ_PROBE_ARGS: JSON.stringify({ kind: "resourceorder", root, output, components, emitterComponents }),
    },
  })

  const css = value.css
  assert.ok(css.length > 0, "coverage floor: index.css is empty")

  const positions = Object.keys(components).map((name) => ({
    name,
    at: css.indexOf(`.ord-${name}`),
    count: (css.match(new RegExp(`\\.ord-${name}\\b`, "g")) ?? []).length,
  }))

  for (const p of positions) {
    assert.ok(p.at >= 0, `component ${p.name}'s css never reached index.css`)
    assert.equal(
      p.count,
      1,
      `component ${p.name} appears ${p.count} times in index.css; the Set dedup by component ` +
        `identity is gone, and every duplicated component is now paying for itself twice in the bundle`,
    )
  }

  const order = positions.slice().sort((a, b) => a.at - b.at).map((p) => p.name)
  assert.deepEqual(
    order,
    ["shared", "beta", "gamma", "delta"],
    "components are no longer collected in first-seen order across emitters; resource order is " +
      "byte-significant, so this changes index.css and postscript.js for every page",
  )

  console.log(
    `  [coverage] ComponentResources order: ${positions.length} components across ` +
      `${emitterComponents.length} emitters, ${emitterComponents.flat().length} sightings ` +
      `deduped to ${positions.length}, first-seen order preserved`,
  )
})

// ---------------------------------------------------------------------------------------------
// ContentPage — the SHARDED ABI must be byte-identical to the un-sharded one
// ---------------------------------------------------------------------------------------------

// `quartz.config.ts` calls `Plugin.ContentPage()` with no arguments, so `userOpts` is undefined,
// `emitShard` is defined, and PRODUCTION SHARDS. Every other ContentPage assertion in this file
// drives the 3-arg `emit()`, so without this test the path production actually runs is ungated —
// which is the same class of hole the selection/order audit was looking for, arriving in a patch.
//
// The assertion is the byte-parity discipline in one test: split the corpus into owned slices,
// render each through `emitShard` with the COMPLETE roster, and require the union to equal the
// un-sharded output byte for byte. Anything the shard transport loses — a dropped page, a
// different slugMap, a roster that is a copy rather than the corpus — shows up here.
//
// The warning is elected to exactly ONE shard. A diagnostic that fires N times is noise; one that
// fires zero times is worse, because its absence reads as health. This asserts exactly one.

test("ContentPage: sharded emit is byte-identical to un-sharded, and the warning fires exactly once", () => {
  const root = tmp("bjj-cp-shard-")
  const outputA = path.join(root, "out-whole")
  const outputB = path.join(root, "out-sharded")

  // 20 pages over 3 shards, so slices are uneven (7/7/6) and at least one shard is short. No page
  // has the slug `index`, so the missing-home-page warning is armed.
  const pages = Array.from({ length: 20 }, (_, i) => ({
    slug: `Section/Page-${String(i).padStart(2, "0")}`,
    frontmatter: { title: `Page ${i}`, tags: [] },
    // Page 0 is in shard 0; page 19 is in the LAST shard. The transclusion therefore CROSSES a
    // shard boundary, which is the only configuration in which the complete roster matters.
    ...(i === 0 ? { transcludes: "Section/Page-19" } : {}),
    ...(i === 19 ? { providesBlock: true } : {}),
  }))
  // ROSTER-ELIGIBLE PAGES. renderPage inlines `window.__rollPositions` into EVERY page, built by
  // filtering allFiles for `positions/`-prefixed slugs ending `/top` or `/bottom`.
  //
  // ITS SIZE, WITH THE SET DEFINITION, because quartz-cto and I measured two different numbers
  // and both were right (CLAUDE.md §6.9 — the failure is a measurement of the wrong set, not a
  // bad measurement). On `golden/build0/404.html`, which is 27,233 bytes:
  //     the JSON array alone                 18,759 B   68.88%
  //     the `window.__rollPositions=…` expr  18,782 B   68.97%
  //     the whole <script> element           18,842 B   69.19%
  // The 115.1 MB figure behind the post-cutover emit-size cut is the ARRAY boundary
  // (18,759 x 6,138 pages = 115.1 MB), so that is the one to quote when discussing the cut.
  //
  // AND THAT CUT IS WHY THIS IS GATED NOW RATHER THAN LATER: the roster is slated for deletion
  // post-cutover, which makes it the thing most at risk of silent corruption BEFORE then — if we
  // corrupt it pre-cutover and delete it post-cutover, we never learn that we corrupted it. Appended last, so a 3-way split puts them in the FINAL shard while page 0 renders
  // in the first: a shard handed a narrower allFiles then emits a shorter roster on every page it
  // owns. Without these the filter matches nothing, the roster is empty for every shard, and a
  // narrowed-allFiles mutant is invisible — measured, it survived until these existed.
  for (const [pos, role] of [
    ["Mount", "Top"],
    ["Mount", "Bottom"],
    ["Guard", "Top"],
  ]) {
    pages.push({
      slug: `Positions/${pos}/${role}`,
      frontmatter: { title: `${pos} ${role} | BJJ`, tags: [] },
    })
  }

  const { value } = probe(SNIPPET, {
    env: {
      BJJ_PROBE_ARGS: JSON.stringify({
        kind: "contentpage-shard",
        root,
        outputA,
        outputB,
        output: outputA,
        pages,
        shards: 3,
      }),
    },
  })

  const whole = walk(outputA)
  const sharded = walk(outputB)
  assert.ok(whole.length > 0, "coverage floor: the un-sharded run emitted nothing")
  assert.deepEqual(
    sharded,
    whole,
    "the union of the shards is a different file set than the un-sharded emit",
  )
  assert.equal(whole.length, pages.length, "the un-sharded emit lost or duplicated a page")

  // The roster must be COMPLETE on a page rendered in a different shard from the roster pages.
  // This is what makes a narrowed allFiles visible: shard 0 owns Page-00 and the last shard owns
  // the Positions pages, so only a complete roster puts all three into Page-00's bytes.
  const rosterOf = (html) => {
    const m = html.match(/window\.__rollPositions=(\[.*?\])/)
    return m ? JSON.parse(m[1].replace(/\\"/g, '"')) : null
  }
  const rosterWhole = rosterOf(fs.readFileSync(path.join(outputA, "Section", "Page-00.html"), "utf8"))
  const rosterShard = rosterOf(fs.readFileSync(path.join(outputB, "Section", "Page-00.html"), "utf8"))
  assert.ok(Array.isArray(rosterWhole) && rosterWhole.length === 3,
    `the un-sharded run put ${rosterWhole ? rosterWhole.length : "no"} entries in __rollPositions; ` +
      "expected the 3 Positions pages, so this fixture proves nothing")
  assert.deepEqual(
    rosterShard,
    rosterWhole,
    "a shard emitted a different __rollPositions roster than the un-sharded run — the shard was " +
      "handed a narrower allFiles, and this roster is inlined into every page",
  )

  let compared = 0
  for (const rel of whole) {
    assert.deepEqual(
      fs.readFileSync(path.join(outputB, rel)),
      fs.readFileSync(path.join(outputA, rel)),
      `${rel} differs between the sharded and un-sharded emit`,
    )
    compared++
  }
  assert.ok(compared > 0, "coverage floor: zero files byte-compared across the two ABIs")

  // Exactly one shard warns. Count across all shards, not per shard: N warnings is noise and
  // zero is a diagnostic that has silently stopped working.
  const warned = value.warnB.filter((w) => w.some((line) => line.includes("index.md"))).length
  assert.equal(
    warned,
    1,
    `the missing-index warning fired in ${warned} of ${value.warnB.length} shards; exactly one shard must own it`,
  )
  assert.ok(
    value.warnA.some((line) => line.includes("index.md")),
    "the un-sharded path stopped warning about the missing index page",
  )

  // FINDING 3 from the review, pinned: the custom-layout opt-out is a selection rule, and a
  // selection rule with no assertion flips silently on the next refactor.
  assert.equal(
    value.customLayoutHasShard,
    false,
    "a custom-layout ContentPage now exposes emitShard — custom layouts may read arbitrary " +
      "other-page trees that the shard transport omits with throwing accessors",
  )

  // THE ROSTER IS LOAD-BEARING, not merely present. Page 0 transcludes a block from page 19,
  // which a 3-way split puts in a different shard. If the marker is absent the transclusion was
  // dropped, which is exactly what a shard-local slugMap does — silently.
  const wholeSrc = fs.readFileSync(path.join(outputA, "Section", "Page-00.html"), "utf8")
  const shardedSrc = fs.readFileSync(path.join(outputB, "Section", "Page-00.html"), "utf8")
  assert.ok(
    wholeSrc.includes("TRANSCLUDED-MARKER-9f2a"),
    "the un-sharded run did not resolve the transclusion, so this fixture proves nothing",
  )
  assert.ok(
    shardedSrc.includes("TRANSCLUDED-MARKER-9f2a"),
    "the sharded run lost a CROSS-SHARD transclusion — the slugMap was built from the shard's " +
      "own pages instead of the complete roster, and renderPage drops an unresolved transclude " +
      "silently (no fallback when slugMap is present and misses)",
  )

  console.log(
    `  [coverage] ContentPage shard parity: ${compared} files byte-compared across ${value.warnB.length} ` +
      `shards vs one un-sharded run, warning fired in exactly ${warned}, 1 cross-shard ` +
      `transclusion resolved, custom layout opts out`,
  )
})

// ---------------------------------------------------------------------------------------------
// ComponentResources — the ORDER WITHIN the bundles
// ---------------------------------------------------------------------------------------------

// INTERFACE.md says "resource order is byte-significant" twice and gated it nowhere. The
// first-seen COMPONENT order is covered above; this covers the order WITHIN the two bundles,
// which is decided by fixed concatenation rather than by component collection:
//
//   afterDOMLoaded, in push order: popover -> analytics -> supabase -> SPA router
//   index.css, via joinStyles:     component css -> custom.scss -> the :root theme block LAST
//
// This is the PostHog surface (recon R8), pinned verbatim by three gates and a paths: filter, so
// a reordering here moves bytes that other people's gates assert on.
//
// THE SPA POSITION IS SEMANTIC, NOT COSMETIC. componentResources.ts says it in place: the router
// is pushed last because the "nav" event fires from it and every other script must have had the
// chance to register a listener first. Move it earlier and the bundle still works on most pages
// and silently loses listeners on the rest — so this assertion is about behaviour that only
// shows up as a byte order.

test("ComponentResources: bundle order — SPA router last in postscript, theme block last in css", () => {
  const r = runComponentResources(
    {
      analytics: {
        provider: "posthog",
        apiKey: "phc_ORDERKEY",
        host: "https://us.i.posthog.com",
        uiHost: "https://us.i.posthog.com",
      },
      supabase: { url: "https://order.supabase.co", anonKey: "anon_ORDERKEY" },
    },
    "order",
  )

  // ---- postscript.js: the push order of addGlobalPageResources ----
  const at = (needle, where) => {
    const i = where.indexOf(needle)
    assert.ok(i >= 0, `bundle does not contain ${JSON.stringify(needle)} at all`)
    return i
  }
  const popover = at("popover", r.postscript)
  const posthog = at("window.posthog", r.postscript)
  const supabase = at("__SUPABASE_URL", r.postscript)
  const spa = at("spaNavigate", r.postscript)

  assert.ok(popover < posthog, "the popover script no longer precedes the analytics block")
  assert.ok(posthog < supabase, "the Supabase block no longer follows the analytics block")
  assert.ok(
    supabase < spa,
    "the SPA router no longer comes last in afterDOMLoaded. It is pushed last on purpose: the " +
      "'nav' event fires from it and every other script must have registered its listener first. " +
      "Moving it earlier works on most pages and silently drops listeners on the rest.",
  )

  // ---- index.css: joinStyles' fixed concatenation ----
  // joinStyles(theme, ...stylesheet) emits the STYLESHEETS FIRST and the :root theme block LAST —
  // the opposite of what the argument order suggests, which is why this is pinned by measurement
  // rather than by reading the call site.
  const popoverCss = at(".popover", r.css)
  const customCss = at(".entity-relations", r.css) // unique to styles/custom.scss
  const themeBlock = at("--graphPosition", r.css) // inside the generated :root block
  assert.ok(popoverCss < customCss, "component css no longer precedes custom.scss")
  assert.ok(
    customCss < themeBlock,
    "the :root theme block is no longer last; joinStyles appends it after every stylesheet",
  )

  console.log(
    `  [coverage] ComponentResources order: 4 afterDOMLoaded blocks in push order ` +
      `(popover<posthog<supabase<spa), 3 css sections in concatenation order ` +
      `(component<custom<:root)`,
  )
})

// ---------------------------------------------------------------------------------------------
// 404Page is the SOLE registrant of NotFound's css and script
// ---------------------------------------------------------------------------------------------

// `404.tsx:16` is the only `pageBody: NotFound()` in any emitter, so 404Page alone puts
// notFound.scss (2,365 B) into index.css and notFound.inline.ts (9,121 B) into postscript.js —
// two bundles it never writes itself and that every one of the 6,149 pages loads.
//
// That makes it CLAUDE.md §6.7's "deleting a component deletes a capability", but with a BYTE
// SIGNATURE: the loss is catchable from the bundles rather than only from a component census,
// which is a stronger gate because it does not depend on anyone maintaining a census.
//
// The test removes 404Page from the REAL configured emitter list and requires the markers to
// vanish. That is two claims at once: 404Page contributes them, and nothing else puts them back.
// A census can only ever assert the first.
//
// MUTANTS, AND ONE THAT WAS A FALSE KILL — worth keeping because the shape is easy to repeat:
//   - 404Page stops registering its pageBody                      … kills (capability lost)
//   - a SECOND emitter also registers NotFound                    … kills (sole-registrant lost)
//
// My first attempt at the second mutant added `const NotFoundDup = NotFound()` to contentPage.tsx
// WITHOUT importing NotFound. The suite went red — and proved nothing, because the mutant did not
// compile. A red from a broken build looks exactly like a red from a violated claim. The real
// mutant imports NotFound into folderPage.tsx and adds it to getQuartzComponents: `tsc --noEmit`
// then exits 0 and the failure message is the claim itself, ".did-you-mean is still in index.css
// without 404Page". VERIFY A MUTANT COMPILES BEFORE COUNTING ITS KILL.

test("404Page is the sole registrant of NotFound's css and script, and its removal is visible in the bundles", () => {
  const root = tmp("bjj-sole-")
  const outputA = path.join(root, "with-404")
  const outputB = path.join(root, "without-404")

  const { value } = probe(SNIPPET, {
    env: {
      BJJ_PROBE_ARGS: JSON.stringify({
        kind: "sole-registrant",
        root,
        outputA,
        outputB,
        output: outputA,
        exclude: "404Page",
      }),
    },
  })

  assert.equal(
    value.without.emitters,
    value.withAll.emitters - 1,
    "the fixture did not actually remove exactly one emitter",
  )

  // Markers taken from the two source files, not from a previous run's output.
  const cssMarkers = [".did-you-mean", ".home-fallback", ".action-button"]
  const jsMarkers = ["not-found-title", "did-you-mean-link", "create-page-link"]

  let checked = 0
  for (const m of cssMarkers) {
    assert.ok(value.withAll.css.includes(m), `index.css never contained ${m} even WITH 404Page`)
    assert.ok(
      !value.without.css.includes(m),
      `${m} is still in index.css without 404Page — either another emitter registers NotFound ` +
        `(so 404Page is not the sole registrant) or the marker is not unique to notFound.scss`,
    )
    checked++
  }
  for (const m of jsMarkers) {
    assert.ok(value.withAll.post.includes(m), `postscript.js never contained ${m} even WITH 404Page`)
    assert.ok(!value.without.post.includes(m), `${m} is still in postscript.js without 404Page`)
    checked++
  }
  assert.ok(checked > 0, "coverage floor: no markers checked")

  // And the loss has a SIZE, which is the part a census cannot give you.
  const cssLost = value.withAll.css.length - value.without.css.length
  const jsLost = value.withAll.post.length - value.without.post.length
  assert.ok(
    cssLost > 0 && jsLost > 0,
    `removing 404Page changed no bundle bytes (css ${cssLost}, js ${jsLost}) — the capability ` +
      `would be deletable with no byte signature at all`,
  )

  console.log(
    `  [coverage] 404Page sole registrant: ${checked} markers present-with and absent-without ` +
      `across 2 bundles; removing it costs ${cssLost} css bytes and ${jsLost} js bytes`,
  )
})

// ---------------------------------------------------------------------------------------------
// The in-build emit ledger: attribution must be a PARTITION of what was written
// ---------------------------------------------------------------------------------------------

// D-B-05. The batched re-capture is one build, so attribution has to be observed DURING it —
// a finished tree says what exists, not which emitter wrote it. This gates the observer itself.
//
// Three properties, and the third is the one a count cannot give you:
//   1. every emitter that wrote anything has a ledger entry (no silent gap)
//   2. the union of claims equals the filesystem walk (no unclaimed path, in a fixture where no
//      post-processor runs — in a real build the unclaimed set is F's output and is asserted by
//      shape, never by membership)
//   3. NO PATH IS CLAIMED TWICE. Attribution must PARTITION the output. This is what would break
//      if the ledger used a module-level "current emitter" instead of AsyncLocalStorage, because
//      phase two runs emitters concurrently through one shared write().

test("emit ledger: attribution partitions the output, under the real concurrent driver", () => {
  // TWO cwd-relative dependencies pull in opposite directions and the fixture has to satisfy both:
  //   static.ts resolves its source as `quartz/static` relative to cwd
  //   renderPage's loadGraphData reads `<cwd>/../graph.json` and now THROWS if it is missing
  //     (S1's authorised change — the bare catch became a hard failure)
  // So cwd is a NESTED directory with graph.json in its parent.
  const base = tmp("bjj-ledger-")
  const root = path.join(base, "work")
  const output = path.join(root, "out")
  fs.mkdirSync(path.join(root, "quartz", "static", "sub"), { recursive: true })
  fs.writeFileSync(path.join(root, "quartz", "static", "a.txt"), "a")
  fs.writeFileSync(path.join(root, "quartz", "static", "sub", "b.txt"), "b")
  // A minimal graph with a positive entry count: loadGraphData also throws on zero coverage, so
  // an empty object would fail for a second, different reason.
  fs.writeFileSync(
    path.join(base, "graph.json"),
    JSON.stringify({ positions: { "fixture-node": { title: "Fixture" } } }),
  )

  // filePath is required: AliasRedirects reads `path.dirname(file.data.filePath!)` to resolve an
  // alias relative to its own file's directory. defaultProcessedContent assigns only what it is
  // given, so a synthetic page without it throws — which is a fixture gap, not an emitter defect.
  const mkPage = (slug, title, tags) => ({
    slug,
    filePath: path.join(root, "content", `${slug}.md`),
    frontmatter: { title, tags },
  })
  const pages = [
    mkPage("index", "Home", ["alpha"]),
    mkPage("Section/One", "One", ["alpha"]),
    mkPage("Section/Two", "Two", []),
  ]

  const { value } = probe(SNIPPET, {
    env: {
      BJJ_PROBE_ARGS: JSON.stringify({ kind: "ledger", root, output, pages, directory: path.join(root, "content") }),
      BJJ_EMIT_LEDGER_DIR: path.join(root, "ledger"),
    },
  })

  assert.ok(value.enabled, "the ledger did not activate; BJJ_EMIT_LEDGER_DIR was not seen")

  const claims = value.claims
  const emitters = Object.keys(claims)
  assert.ok(emitters.length > 0, "coverage floor: the ledger attributed nothing at all")

  // 3. PARTITION: no path claimed by two emitters.
  const owner = new Map()
  const doubles = []
  for (const [emitter, paths] of Object.entries(claims)) {
    for (const rel of paths) {
      if (owner.has(rel)) doubles.push(`${rel} claimed by both ${owner.get(rel)} and ${emitter}`)
      else owner.set(rel, emitter)
    }
  }
  assert.deepEqual(doubles, [], "attribution is not a partition — a path was claimed twice")

  // 2. every written path is claimed, and every claim exists.
  const walked = new Set(walk(output))
  const unclaimed = [...walked].filter((p) => !owner.has(p)).sort()
  const phantom = [...owner.keys()].filter((p) => !walked.has(p)).sort()
  assert.deepEqual(
    unclaimed,
    [],
    `paths exist that no emitter claimed: ${unclaimed.slice(0, 5).join(", ")} — in this fixture no ` +
      `post-processor runs, so every file must be attributable`,
  )
  assert.deepEqual(
    phantom,
    [],
    `the ledger claimed paths that do not exist: ${phantom.slice(0, 5).join(", ")} — a ledger that ` +
      `records intent rather than result is the defect the post-build walk exists to prevent`,
  )

  // 1. the emitters that produced output are the ones with entries.
  assert.ok(owner.size >= walked.size, "coverage floor: fewer claims than files")
  console.log(
    `  [coverage] emit ledger: ${walked.size} files written by ${emitters.length} emitters under ` +
      `the real emitContent, partition exact (0 double-claims, 0 unclaimed, 0 phantom)`,
  )
})

