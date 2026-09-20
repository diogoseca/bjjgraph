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
import { write } from ${q("quartz/plugins/emitters/helpers")}

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
