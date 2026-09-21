import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import type { BuildCtx } from "../util/ctx"
import type { EmitSchedule } from "./emit"
import { enabled, snapshot } from "../plugins/emitters/emitLedger"

type Discovery = { all: number; md: number; parsed: number; published: number }

// Resolve existing ancestors too: lexical containment alone misses symlinks into public.
function physicalPath(value: string): string {
  const absolute = path.resolve(value)
  if (fs.existsSync(absolute)) return fs.realpathSync(absolute)
  return path.join(physicalPath(path.dirname(absolute)), path.basename(absolute))
}

function overlaps(left: string, right: string): boolean {
  const contains = (parent: string, child: string) => {
    const relative = path.relative(parent, child)
    return (
      relative === "" ||
      (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
    )
  }
  return contains(left, right) || contains(right, left)
}

/** Only called when the already-existing emitter ledger is enabled. */
export async function createEmitObserver(ctx: BuildCtx) {
  const requested = process.env.BJJ_EMIT_LEDGER_DIR
  if (!requested || !path.isAbsolute(requested)) {
    throw new Error("BJJ_EMIT_LEDGER_DIR must be an absolute, fresh observer directory")
  }
  const contentReceipt = process.env.BJJ_CONTENT_RECEIPT
  const captureId = process.env.BJJ_CAPTURE_ID
  if (!contentReceipt || !path.isAbsolute(contentReceipt) || !captureId) {
    throw new Error("Emit observer requires BJJ_CONTENT_RECEIPT (absolute) and BJJ_CAPTURE_ID")
  }
  const receipt = JSON.parse(fs.readFileSync(contentReceipt, "utf8"))
  if (
    receipt.schema !== "quartz-content-provenance-v1" ||
    receipt.state !== "capturing" ||
    receipt.capture_id !== captureId ||
    receipt.content_clean_at_start !== true
  ) {
    throw new Error("Emit observer requires a matching capture-time content receipt")
  }
  if (ctx.argv.serve) throw new Error("Emit observer requires one build, not --serve")
  const source = fs.realpathSync(process.cwd())
  const root = path.resolve(source, "..")
  const ledger = physicalPath(requested)
  const output = physicalPath(ctx.argv.output)
  const content = physicalPath(ctx.argv.directory)
  for (const protectedPath of [output, content, source, path.join(root, "scripts")]) {
    if (overlaps(ledger, protectedPath)) {
      throw new Error(`Emit observer directory overlaps a build input/output: ${protectedPath}`)
    }
  }
  // The producer's existing provenance fingerprint names this exact corpus. Refuse a
  // custom content base until that reader can assert it, rather than attest another tree.
  if (content !== physicalPath(path.join(root, "content"))) {
    throw new Error("Emit observer provenance currently requires the repository content directory")
  }
  if (fs.existsSync(ledger) && fs.readdirSync(ledger).length !== 0) {
    throw new Error(`Emit observer directory is not fresh: ${ledger}`)
  }
  fs.mkdirSync(ledger, { recursive: true })
  if (!enabled) throw new Error("Emitter ledger did not activate before the observer")

  // Runtime URL keeps capture tooling out of both ordinary bundles. Importing the CLI's
  // guarded module calls no parser/emitter; this is the shared collector/join, not --join.
  const producer = await import(
    pathToFileURL(path.join(root, "scripts/emit_seam_capture.mjs")).href
  )
  const before = producer.inputFingerprint()
  const records = path.join(ledger, "records")
  const rawOutput = path.join(ledger, "raw-output")
  return {
    async finish(schedule: EmitSchedule, discovered: Discovery, parseMs: number) {
      if (discovered.parsed !== discovered.md || discovered.published <= 0) {
        throw new Error(`Emit observer input coverage ${discovered.parsed}/${discovered.md}`)
      }
      if (producer.inputFingerprint().sha256 !== before.sha256) {
        throw new Error("Emit observer inputs changed while the build was running")
      }
      fs.mkdirSync(rawOutput)
      const captured = producer.collectEmitCensus({
        output,
        ledgerDir: ledger,
        rawOutput,
        staticSourceRoot: path.join(source, "quartz", "static"),
        configuredEmitters: ctx.cfg.plugins.emitters.map((emitter) => emitter.name),
        discovered,
        ledgerEnabled: enabled,
        mainMemoryPaths: Object.values(snapshot()).reduce(
          (count, paths) => count + paths.length,
          0,
        ),
        parseMs,
        concurrency: ctx.argv.concurrency,
        schedule,
      })
      captured.capture_id = captureId
      const seeded = producer.seededRegions(captured.copy_source_files)
      // Seed-manifest mismatch sets exitCode in the legacy CLI helper. An in-build
      // observer must reject immediately instead of publishing a plausible capture.
      if (process.exitCode) throw new Error("Emit observer seed provenance failed")
      const joined = producer.joinRecords(captured, records, {
        concurrency: ctx.argv.concurrency,
        expectParts: 1 + schedule.workerThreads,
        retainOutput: true,
        publishAnyway: false,
        seeded,
        limit: 0,
        provenance: { content_receipt: contentReceipt, capture_id: captureId },
        producer: "source/quartz/build.ts -> scripts/emit_seam_capture.mjs:joinRecords",
      })
      if (!joined.published || joined.problems.length !== 0) {
        throw new Error(`Emit observer join withheld: ${joined.problems.join("; ")}`)
      }
      const count = Object.keys(joined.per).length
      const expected = ctx.cfg.plugins.emitters.length
      if (count !== expected || count === 0) {
        throw new Error(`Emit observer record coverage ${count}/${expected}`)
      }
      console.log(
        `[emit:observer] records=${count}/${expected} census=${joined.censusSize} parts=${joined.parts.length}/${1 + schedule.workerThreads} claimedMissing=${joined.claimMissing.length} unclaimed=${joined.unclaimed.length} conflicts=${joined.conflicts.length} repeats=${joined.repeats.length} retained=${rawOutput}`,
      )
      return { records: count, files: joined.censusSize, outDir: records }
    },
  }
}
