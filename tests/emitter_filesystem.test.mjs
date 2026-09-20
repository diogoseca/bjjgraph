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
//   - `helpers.ts`: append `"\n"` to the written content                 … kills "byte-exact write"
//   - `helpers.ts`: return the path before awaiting `writeFile`          … kills "completed write"
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
const SNIPPET = `
import { Static } from ${q("quartz/plugins/emitters/static")}
import { Assets } from ${q("quartz/plugins/emitters/assets")}
import { AliasRedirects } from ${q("quartz/plugins/emitters/aliases")}
import { ContentIndex } from ${q("quartz/plugins/emitters/contentIndex")}
import { ComponentResources } from ${q("quartz/plugins/emitters/componentResources")}
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
    cwd: root,
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
    cwd: root,
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
    cwd: root,
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
    cwd: root,
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
    cwd: root,
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
  const locs = (value.sitemap.match(/<loc>/g) ?? []).length
  assert.equal(locs, pages.length, "the sitemap must carry every indexed page, not the RSS subset")

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

  console.log(
    `  [coverage] ContentIndex: 4 artifacts, ${keys.length} index entries all stripped of ` +
      `description+date, ${items} RSS items from ${pages.length} pages, ${locs} sitemap locs, ` +
      `1 truncation at 3,000 chars, gzip MTIME=0`,
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
    cwd: root,
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
