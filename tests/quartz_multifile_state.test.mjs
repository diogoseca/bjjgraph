// ── MODULE-LEVEL STATE ACROSS FILES — the class every other spec here is blind to ──────────────
//
// WHY THIS FILE EXISTS. `runPipeline` in `_quartz_pipeline.mjs` builds a FRESH unified processor
// for every call, so module-level state resets between fixtures by accident. The real driver does
// the opposite: `processors/parse.ts` builds ONE processor per chunk and runs many files through
// it. Any transformer holding state at module scope is therefore invisible to every other spec in
// this directory, no matter how many fixtures they add.
//
// FOUND BY THE D-212 MUTANT SWEEP. `toc.ts:27` holds `const slugAnchor = new Slugger()` at MODULE
// scope, reset per file inside the transform. Deleting that reset (mutant TC-3) SURVIVED all 82
// assertions across the ten spec files. Driven properly — one processor, three files — it does
// this:
//     file 1   same-heading,other-heading
//     file 2   same-heading-1,other-heading-1      <- every TOC link now points at an id
//     file 3   same-heading-2,other-heading-2         rehype-slug never wrote
// Blast radius from the corpus, not from reasoning: the h2 "Film Study" appears in **4,452 of the
// 4,600** content files, so a single build would mis-anchor the table of contents on essentially
// every page, silently, with every page still rendering.
//   Recompute: count `^##\s+Film Study$` across `content/**/*.md`.
//
// THIS FILE USES REAL CORPUS FILES, DELIBERATELY. Fabricated fixtures would have to exist on disk
// for `CreatedModifiedDate` to stat them, and dropping that transformer to avoid it would mean
// asserting against a processor the driver never builds. Three real files that share a heading
// give the full transformer set and the real configured order.
//
// WHAT IT DOES NOT CLAIM (§6.9): it is not a general freedom-from-shared-state proof. It drives
// ONE processor over THREE files and asserts the TOC is stable. A transformer that accumulates
// state affecting some other field would need its own case here — the point of this file is that
// there is now somewhere for that case to go.
import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { harnessAvailable, loadConfig, sourceRequire, REPO } from "./_quartz_pipeline.mjs"

const skip = !harnessAvailable()
if (skip) console.log("SKIP: source/node_modules is absent — this file asserted NOTHING")

const SHARED_HEADING = "Film Study"

/** Find N real content files that all carry the same `## <heading>`. Derived from the corpus every
 *  run, so a content change that retires the heading fails loudly here instead of quietly
 *  reducing this file to a no-op. */
function filesSharing(heading, n) {
  const want = new RegExp(`^##\\s+${heading}\\s*$`, "m")
  const out = []
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (out.length >= n) return
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith(".md") && want.test(fs.readFileSync(p, "utf8"))) out.push(p)
    }
  }
  walk(path.join(REPO, "content"))
  return out
}

test("ONE PROCESSOR, MANY FILES — no module-level state leaks between them", async (t) => {
  if (skip) return t.skip("harness unavailable")

  const files = filesSharing(SHARED_HEADING, 3)
  assert.equal(
    files.length,
    3,
    `needed 3 corpus files carrying "## ${SHARED_HEADING}" and found ${files.length}. Without a ` +
      "repeated heading this test cannot observe the defect it exists for, and passing would " +
      "mean nothing (CLAUDE.md §6.6)",
  )

  const req = sourceRequire()
  const { unified } = req("unified")
  const remarkParse = req("remark-parse").default
  const remarkRehype = req("remark-rehype").default
  const { VFile } = req("vfile")
  const cfg = await loadConfig()
  const tr = cfg.plugins.transformers
  const ctx = {
    buildId: "multifile",
    cfg,
    allSlugs: [],
    argv: { directory: "../content", output: "public", verbose: false, serve: false, fastRebuild: false, port: 8080, wsPort: 3001 },
  }

  // Built ONCE, the way processors/parse.ts builds it per chunk. This is the whole point: a fresh
  // processor per file would reset module state and the assertion below could never fail.
  let proc = unified().use(remarkParse)
  for (const p of tr.filter((p) => p.markdownPlugins)) proc = proc.use(p.markdownPlugins(ctx))
  proc = proc.use(remarkRehype, { allowDangerousHtml: true })
  for (const p of tr.filter((p) => p.htmlPlugins)) proc = proc.use(p.htmlPlugins(ctx))

  const tocs = []
  for (const abs of files) {
    const file = new VFile({ value: fs.readFileSync(abs, "utf8"), path: abs, cwd: path.join(REPO, "source") })
    file.value = file.value.toString().trim()
    for (const p of tr.filter((p) => p.textTransform)) file.value = p.textTransform(ctx, file.value.toString())
    file.data.filePath = abs
    file.data.relativePath = path.relative(path.join(REPO, "content"), abs)
    file.data.slug = file.data.relativePath.replace(/\.md$/, "").replace(/ /g, "-")
    const ast = proc.parse(file)
    await proc.run(ast, file)
    tocs.push(file.data.toc ?? [])
  }

  // NON-TRIVIALITY FIRST. Equal-but-empty is the failure mode that would make this pass forever.
  const anchorOf = (toc) => toc.find((e) => e.text?.trim() === SHARED_HEADING)?.slug
  const anchors = tocs.map(anchorOf)
  assert.ok(
    anchors.every(Boolean),
    `every file must produce a TOC entry for "${SHARED_HEADING}"; got ${JSON.stringify(anchors)}`,
  )

  assert.equal(
    new Set(anchors).size,
    1,
    `the same heading text must slug to the SAME anchor in every file. Got ${JSON.stringify(anchors)}. ` +
      "A numeric suffix means `toc.ts`'s module-level Slugger carried state across files, so every " +
      "TOC link after the first page points at an id rehype-slug never wrote — on the 4,452 of " +
      "4,600 corpus files that share this heading",
  )

  // THE GENERAL FORM, and it is a DIFFERENTIAL against a control rather than a rule I invented.
  // My first attempt here asserted "no anchor may carry a `-N` suffix", which is stricter than the
  // claim and went RED on a correct build: `key-principles-1` is CORRECT when a heading text
  // repeats WITHIN one document — that is Slugger disambiguating, which is its job. The real
  // invariant is that running a file through the SHARED processor must produce exactly what a
  // FRESH processor produces for that same file. That catches any module-level accumulation, not
  // just this one, and it cannot be satisfied by a rule the spec made up (CLAUDE.md §6.3).
  let compared = 0
  for (const [i, abs] of files.entries()) {
    let fresh = unified().use(remarkParse)
    for (const p of tr.filter((p) => p.markdownPlugins)) fresh = fresh.use(p.markdownPlugins(ctx))
    fresh = fresh.use(remarkRehype, { allowDangerousHtml: true })
    for (const p of tr.filter((p) => p.htmlPlugins)) fresh = fresh.use(p.htmlPlugins(ctx))

    const file = new VFile({ value: fs.readFileSync(abs, "utf8"), path: abs, cwd: path.join(REPO, "source") })
    file.value = file.value.toString().trim()
    for (const p of tr.filter((p) => p.textTransform)) file.value = p.textTransform(ctx, file.value.toString())
    file.data.filePath = abs
    file.data.relativePath = path.relative(path.join(REPO, "content"), abs)
    file.data.slug = file.data.relativePath.replace(/\.md$/, "").replace(/ /g, "-")
    const ast = fresh.parse(file)
    await fresh.run(ast, file)

    assert.ok((file.data.toc ?? []).length > 0, `${file.data.slug}: the control run produced an EMPTY toc, so comparing against it proves nothing`)
    assert.deepEqual(
      tocs[i].map((e) => e.slug),
      (file.data.toc ?? []).map((e) => e.slug),
      `${file.data.slug}: the shared processor produced different TOC anchors than a fresh one. ` +
        "Some transformer is carrying module-level state between files",
    )
    compared += 1
  }
  assert.equal(compared, files.length, "every file must have been compared against its control")

  console.log(
    `  coverage: ${files.length} real corpus files through ONE processor, ` +
      `${tocs.flat().length} toc entries, anchor "${anchors[0]}" stable, ` +
      `${compared} shared-vs-fresh differentials`,
  )
})
