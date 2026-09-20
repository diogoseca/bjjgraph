#!/usr/bin/env node
/**
 * PER-TRANSFORMER PARITY against stream V's transform seam.
 *
 * WHAT THIS ANSWERS, AND WHY IT IS NOT `emit_diff.py`. `emit_diff` compares the finished SITE and
 * tells you that 4,600 files changed. This compares the markdown pipeline STAGE BY STAGE against
 * the incumbent driver's own recorded output and tells you WHICH TRANSFORMER introduced the
 * difference, on WHICH file, at WHICH stage. That attribution is the whole point of stream V's
 * seam and it is what makes the byte-convergence tail tractable.
 *
 * WHAT IT COMPARES. `golden/seams-v1/transform/<source>.md/<NN>-<phase>-<Transformer>.json.gz`
 * holds, per file per stage, the full AST and the VFile data as the REAL driver produced them —
 * captured on the worker path at concurrency 4, which `provenance.mode` in each record declares.
 * This script rebuilds the same phase-major schedule (INTERFACE.md §4 steps 1-5) with a snapshot
 * interleaved after every transformer's plugin group, so the stage boundaries line up exactly and a
 * difference is attributed to the transformer that INTRODUCED it. Only the FIRST divergence per
 * file is reported: every stage after it is a consequence, not an independent finding.
 *
 *   node scripts/check_transform_parity.mjs                 # a diverse sample (default)
 *   node scripts/check_transform_parity.mjs --all           # all 4,600 files, ~17 min, ONE core
 *   node scripts/check_transform_parity.mjs --sample 200
 *   node scripts/check_transform_parity.mjs --file "Positions/Mount.md" --verbose
 *
 * THE COMPARATOR IS ITSELF UNTESTED CODE, AND IT WAS THE BUG THREE TIMES BEFORE THIS SCRIPT
 * EXISTED. A differential is only as good as its normalizer. All three defects are fixed here and
 * named so nobody reintroduces them:
 *   1. KEY ORDER. V encodes with `sort_keys=True` and states the contract: "object key order is
 *      not a JSON contract; array order, AST positions, metadata, and all string bytes are."
 *      Comparing unsorted produced 4 false differences. -> deep-sort both sides.
 *   2. allSlugs. Passing `[]` made LinkProcessing resolve differently and produced 13 false
 *      differences. The driver's own array — in its own DISCOVERY ORDER, which is load-bearing
 *      because ambiguous wikilinks take the first match — is in `pipeline.json`. -> read it.
 *   3. SENTINELS. V encodes `undefined` as `{"$undefined":true}` and Dates as `{"$date":"…"}`,
 *      because JSON cannot carry either. `JSON.stringify` silently DROPS an undefined-valued key,
 *      so `position.end` looked different on every text node: 9 false differences. -> decode.
 *
 * POSITIVE COVERAGE, HARD-FAILING ON ZERO (CLAUDE.md §6.6). It always prints how many files and
 * how many stage comparisons it made, and exits 2 rather than 0 if that number is zero — a
 * comparator that compared nothing otherwise reports a perfect result.
 *
 * KNOWN AND DELIBERATE EXCLUSION: `dates`. `CreatedModifiedDate` reads real git history and the
 * filesystem, so it cannot be reproduced outside the captured checkout. Stage 04 is compared for
 * its TREE (which it does not modify) and its date VALUES are skipped, loudly, in the output.
 * `tests/quartz_dates_contract.test.mjs` is what gates the dates themselves.
 *
 * Exit 0 parity · 1 a real difference · 2 the instrument could not produce a verdict.
 */
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import path from "node:path"
import fs from "node:fs"
import zlib from "node:zlib"

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SRC = path.join(REPO, "source")
const SEAM = "/home/user/bjj-orchestrator/golden/seams-v1"
const TRANSFORM = path.join(SEAM, "transform")

const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const val = (f, d) => (argv.indexOf(f) >= 0 ? argv[argv.indexOf(f) + 1] : d)

const die = (code, msg) => {
  console.error(`FAIL: ${msg}`)
  process.exit(code)
}

if (!fs.existsSync(TRANSFORM)) die(2, `no transform seam at ${TRANSFORM} — stream V captures it`)

const req = createRequire(path.join(SRC, "package.json"))

// ── the comparator, with all three historical defects fixed ───────────────────────────────────
const decode = (v) => {
  if (Array.isArray(v)) return v.map(decode)
  if (v && typeof v === "object") {
    if (v.$undefined === true) return undefined
    if (typeof v.$date === "string") return v.$date
    const out = {}
    for (const k of Object.keys(v)) {
      const d = decode(v[k])
      if (d !== undefined) out[k] = d
    }
    return out
  }
  return v
}
const sortDeep = (v) =>
  Array.isArray(v)
    ? v.map(sortDeep)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, sortDeep(v[k])]),
        )
      : v
const norm = (o) => JSON.stringify(sortDeep(decode(JSON.parse(JSON.stringify(o)))))

const loadStage = (rel, stage) =>
  JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(TRANSFORM, rel, `${stage}.json.gz`))))

// Every source path the seam holds, discovered from the seam itself rather than from a hand list.
function seamFiles() {
  const out = []
  const walk = (base) => {
    for (const e of fs.readdirSync(path.join(TRANSFORM, base), { withFileTypes: true })) {
      const rel = base ? `${base}/${e.name}` : e.name
      if (e.name.endsWith(".md")) out.push(rel)
      else if (e.isDirectory()) walk(rel)
    }
  }
  walk("")
  return out.sort()
}

/** A DIVERSE sample, not the first N: every top-level directory is represented, plus the files
 *  with known-unusual shape. A contiguous slice would miss the long tail, which is exactly what
 *  silently vanishes in a migration. */
function diverseSample(all, n) {
  const byDir = new Map()
  for (const f of all) {
    const d = f.includes("/") ? f.split("/")[0] : "(root)"
    if (!byDir.has(d)) byDir.set(d, [])
    byDir.get(d).push(f)
  }
  const per = Math.max(1, Math.floor(n / byDir.size))
  const picked = []
  for (const [, files] of byDir) {
    const step = Math.max(1, Math.floor(files.length / per))
    for (let i = 0; i < files.length && picked.length < n; i += step) picked.push(files[i])
  }
  for (const special of ["Game Over.md", "index.md", "Learning/BJJ Position Hierarchy Explained.md"]) {
    if (all.includes(special) && !picked.includes(special)) picked.push(special)
  }
  return picked
}

async function main() {
  const { unified } = req("unified")
  const remarkParse = req("remark-parse").default
  const remarkRehype = req("remark-rehype").default
  const { VFile } = req("vfile")

  // The real config, through the same bridge the unit gates use.
  const { loadConfig } = await import(path.join(REPO, "tests", "_quartz_pipeline.mjs"))
  const cfg = await loadConfig()
  const transformers = cfg.plugins.transformers

  const pipelineMeta = JSON.parse(fs.readFileSync(path.join(SEAM, "pipeline.json"), "utf8"))
  const allSlugs = pipelineMeta.allSlugs
  if (!Array.isArray(allSlugs) || allSlugs.length === 0) {
    die(2, "pipeline.json carries no allSlugs — LinkProcessing cannot be compared without it")
  }

  const all = seamFiles()
  if (all.length === 0) die(2, "the seam holds zero source paths")
  const targets = has("--file")
    ? [val("--file")]
    : has("--all")
      ? all
      : diverseSample(all, Number(val("--sample", "40")))

  const ctx = {
    buildId: "transform-parity",
    cfg,
    allSlugs,
    argv: {
      directory: "../content",
      output: "public",
      verbose: false,
      serve: false,
      fastRebuild: false,
      port: 8080,
      wsPort: 3001,
    },
  }

  // Stage names, derived from the seam's own directory listing so this cannot drift from what V
  // captured. Stage 01 is the text transform, 02 the parse; the rest are per-transformer groups.
  const stageNames = fs
    .readdirSync(path.join(TRANSFORM, all[0]))
    .map((f) => f.replace(/\.json\.gz$/, ""))
    .sort()

  let files = 0
  let comparisons = 0
  const diffs = []
  const errors = []

  for (const rel of targets) {
    try {
      const abs = path.join(REPO, "content", rel)
      if (!fs.existsSync(abs)) {
        errors.push(`${rel}: not in the working tree`)
        continue
      }
      const final = loadStage(rel, stageNames[stageNames.length - 1])
      const file = new VFile({
        value: fs.readFileSync(abs, "utf8"),
        path: `../content/${rel}`,
        cwd: SRC,
      })

      // §4 step 1 — trim, then every textTransform in configured order.
      file.value = file.value.toString().trim()
      for (const p of transformers.filter((p) => p.textTransform)) {
        file.value = p.textTransform(ctx, file.value.toString())
      }
      const textStage = stageNames.find((s) => s.includes("-text-"))
      if (textStage) {
        comparisons += 1
        const golden = loadStage(rel, textStage)
        if (golden.data.text !== file.value.toString()) diffs.push(`${rel} :: ${textStage} :: text`)
      }

      // §4 step 2 — identity. Take the DRIVER's slug rather than re-deriving it: re-deriving would
      // test this script's copy of slugifyFilePath, not the pipeline (CLAUDE.md §6.3).
      file.data.filePath = `../content/${rel}`
      file.data.relativePath = rel
      file.data.slug = final.data.file.data.slug

      // ── PER-TRANSFORMER SNAPSHOTS ─────────────────────────────────────────────────────────
      // This is what makes the script per-TRANSFORMER rather than end-to-end. A snapshot plugin is
      // interleaved after EACH transformer's plugin group, so the boundaries line up with the
      // seam's own 14 stages and a difference is attributed to the transformer that introduced it
      // instead of to "the pipeline". The clone is eager because later plugins mutate the tree in
      // place — `htmlAst` aliases it by design (INTERFACE.md §2), so a lazy reference would
      // compare the FINAL tree at every stage and report a spurious all-clean.
      const snapshots = new Map()
      const snapshot = (stage) => () => (tree) => {
        snapshots.set(stage, JSON.parse(JSON.stringify(tree)))
      }
      const mdProviders = transformers.filter((p) => p.markdownPlugins)
      const htmlProviders = transformers.filter((p) => p.htmlPlugins)
      const stageFor = (phase, name) =>
        stageNames.find((s) => s.includes(`-${phase}-`) && s.endsWith(`-${name}`))

      let processor = unified().use(remarkParse)
      for (const p of mdProviders) {
        processor = processor.use(p.markdownPlugins(ctx))
        const st = stageFor("markdown", p.name)
        if (st) processor = processor.use(snapshot(st))
      }
      processor = processor.use(remarkRehype, { allowDangerousHtml: true })
      const bridge = stageNames.find((s) => s.includes("-bridge-"))
      if (bridge) processor = processor.use(snapshot(bridge))
      for (const p of htmlProviders) {
        processor = processor.use(p.htmlPlugins(ctx))
        const st = stageFor("html", p.name)
        if (st) processor = processor.use(snapshot(st))
      }
      const tree = await processor.run(processor.parse(file), file)

      // Compare EVERY captured stage, in order, and report the FIRST divergence per file — the
      // stages after it are consequences, not independent findings.
      let firstBad = null
      for (const st of stageNames) {
        if (!snapshots.has(st)) continue
        comparisons += 1
        const golden = loadStage(rel, st)
        // CreatedModifiedDate does not modify the tree; its dates live in file.data and are
        // excluded by design (see the header), so its stage is compared for the TREE only.
        if (norm(snapshots.get(st)) !== norm(golden.data.tree)) {
          firstBad = st
          diffs.push(`${rel} :: ${st}  <- FIRST divergence; this transformer introduced it`)
          break
        }
      }

      comparisons += 1
      if (!firstBad && norm(tree) !== norm(final.data.tree)) diffs.push(`${rel} :: final tree`)

      // Every page-data key, which is what the emitters and components actually read.
      const mine = file.data
      const theirs = final.data.file.data
      for (const k of new Set([...Object.keys(mine), ...Object.keys(theirs)])) {
        if (k === "dates") continue // see the header: git history cannot be reproduced here
        comparisons += 1
        if (norm(mine[k]) !== norm(theirs[k])) {
          diffs.push(`${rel} :: file.data.${k}`)
          if (has("--verbose")) {
            console.log(`  MINE  ${k}: ${norm(mine[k]).slice(0, 200)}`)
            console.log(`  SEAM  ${k}: ${norm(theirs[k]).slice(0, 200)}`)
          }
        }
      }
      files += 1
    } catch (err) {
      errors.push(`${rel}: ${String(err.message).split("\n")[0]}`)
    }
  }

  const mode = pipelineMeta.provenance?.mode ?? {}
  console.log(`transform parity vs ${path.relative(REPO, TRANSFORM)}`)
  console.log(`  seam captured on : ${mode.path ?? "(unstated)"}, concurrency ${mode.concurrency ?? "?"}`)
  console.log(`  files compared   : ${files} of ${all.length} in the seam`)
  console.log(`  comparisons made : ${comparisons}   <- positive coverage count`)
  console.log(`  dates            : SKIPPED by design (git history); gated by quartz_dates_contract`)

  if (files === 0 || comparisons === 0) {
    die(2, "compared nothing — this run proved nothing")
  }
  for (const e of errors) console.error(`  ERROR  ${e}`)
  for (const d of diffs.slice(0, 40)) console.error(`  DIFF   ${d}`)
  if (diffs.length > 40) console.error(`  … and ${diffs.length - 40} more`)
  if (errors.length || diffs.length) {
    console.error(
      `\n${diffs.length} difference(s), ${errors.length} error(s). Each names the file and the ` +
        `stage, so the transformer that introduced it is the one that owns that stage.`,
    )
    process.exit(1)
  }
  console.log("  clean — every compared stage is identical to the incumbent driver's output")
  process.exit(0)
}

main().catch((err) => die(2, err.stack ?? String(err)))
