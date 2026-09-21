import fs from "node:fs"
import path from "node:path"
import { createHash } from "node:crypto"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import { isMainThread, threadId } from "node:worker_threads"
import type { VFile } from "vfile"
import type { BuildCtx } from "../util/ctx"

type Phase = "text" | "parse" | "markdown" | "bridge" | "html"
type Stage = { id: string; phase: Phase; name: string; kind: string }
export type ParseObserverReceipt = {
  coverage: {
    snapshots: number
    parse: number
    transform: number
    by_stage: Record<string, number>
  }
  storage: { bytes: number; uncompressed_bytes: number; reserved_bytes: number }
}
export type ParseObserverInit = {
  output: string
  moduleUrl: string
  budget: SharedArrayBuffer
  maxBytes: number
  stages: Stage[]
  provenance: Record<string, unknown>
  concurrency: number
  chunkSize: number
}

const sha = (value: Buffer | string) => createHash("sha256").update(value).digest("hex")

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

function plan(ctx: BuildCtx): Stage[] {
  const stages: Stage[] = []
  const add = (phase: Phase, name: string, kind: string) => {
    if (stages.some((s) => s.phase === phase && s.name === name)) {
      throw new Error(`Ambiguous observer boundary: ${phase}/${name}`)
    }
    stages.push({
      id: `${String(stages.length + 1).padStart(2, "0")}-${phase}-${name}`,
      phase,
      name,
      kind,
    })
  }
  for (const p of ctx.cfg.plugins.transformers) if (p.textTransform) add("text", p.name, "text")
  add("parse", "remark-parse", "mdast")
  for (const p of ctx.cfg.plugins.transformers)
    if (p.markdownPlugins) add("markdown", p.name, "mdast")
  add("bridge", "remark-rehype", "hast")
  for (const p of ctx.cfg.plugins.transformers) if (p.htmlPlugins) add("html", p.name, "hast")
  if (!stages.some((s) => s.phase === "markdown" && s.name === "FrontMatter")) {
    throw new Error("Parse observer requires the FrontMatter boundary")
  }
  return stages
}

/** The enabled path alone loads V's writer. Never import the standalone capture CLI. */
export function prepareParseObserver(
  ctx: BuildCtx,
  concurrency: number,
  chunkSize: number,
): ParseObserverInit {
  const output = process.env.BJJ_PARSE_OBSERVER!
  if (!path.isAbsolute(output)) throw new Error("BJJ_PARSE_OBSERVER must be an absolute directory")
  const root = path.resolve(process.cwd(), "..")
  // V's content attestation covers repo/content, not arbitrary external vaults.
  if (fs.realpathSync(ctx.argv.directory) !== fs.realpathSync(path.join(root, "content"))) {
    throw new Error("Parse observer content must be the attested repo/content directory")
  }
  const receiptPath = process.env.BJJ_CONTENT_RECEIPT
  const captureId = process.env.BJJ_CAPTURE_ID
  if (!receiptPath || !path.isAbsolute(receiptPath) || !captureId) {
    throw new Error(
      "Parse observer requires BJJ_CONTENT_RECEIPT (absolute) and BJJ_CAPTURE_ID from the scheduled capture envelope",
    )
  }
  const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"))
  if (
    receipt.schema !== "quartz-content-provenance-v1" ||
    receipt.state !== "capturing" ||
    receipt.capture_id !== captureId ||
    receipt.content_clean_at_start !== true
  ) {
    throw new Error("Parse observer requires the matching in-progress content receipt")
  }
  const maxBytes = Number(process.env.BJJ_PARSE_OBSERVER_MAX_BYTES ?? 10 * 1024 ** 3)
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > 10 * 1024 ** 3) {
    throw new Error("BJJ_PARSE_OBSERVER_MAX_BYTES must be a positive integer <=10 GiB")
  }
  const realOutput = physicalPath(output)
  for (const forbidden of [
    ctx.argv.output,
    ctx.argv.directory,
    path.join(root, "source"),
    path.join(root, "scripts"),
    process.env.BJJ_EMIT_LEDGER_DIR,
  ].filter(Boolean) as string[]) {
    if (overlaps(realOutput, physicalPath(forbidden))) {
      throw new Error(
        "Parse observer output must be separate from build inputs, outputs and the emit ledger",
      )
    }
  }
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.mkdirSync(output) // Exclusive capture directory: stale records cannot satisfy coverage.
  const require = createRequire(path.join(root, "source/package.json"))
  const versions: Record<string, string> = {}
  for (const name of ["js-yaml", "gray-matter", "unified", "remark-parse", "remark-rehype"]) {
    let dir = path.dirname(require.resolve(name))
    for (;;) {
      const manifest = path.join(dir, "package.json")
      if (fs.existsSync(manifest)) {
        const pkg = JSON.parse(fs.readFileSync(manifest, "utf8"))
        if (pkg.name === name) {
          versions[name] = pkg.version
          break
        }
      }
      const parent = path.dirname(dir)
      if (dir === parent) throw new Error(`Cannot identify observer dependency ${name}`)
      dir = parent
    }
  }
  return {
    output,
    moduleUrl: pathToFileURL(path.join(root, "scripts/seam_record.mjs")).href,
    budget: new SharedArrayBuffer(8),
    maxBytes,
    stages: plan(ctx),
    concurrency,
    chunkSize,
    provenance: {
      git_head: receipt.capture_git_head,
      capture: "pipeline.json",
      versions,
      capture_id: captureId,
      content_receipt: receiptPath,
      mutant: null,
    },
  }
}

export async function createParseObserver(ctx: BuildCtx, init: ParseObserverInit, part: string) {
  // A variable absolute URL stays a runtime import in both main and parse bundles.
  const { serial, countNodes, createRecordWriter } = await import(init.moduleUrl)
  const mode = {
    path: isMainThread ? "main-thread" : "worker-thread",
    entry: "scheduled createFileParser/createProcessor",
    worker: isMainThread ? null : threadId,
    inline_ts_and_scss: isMainThread ? "full main-bundle resource text" : "empty parse-worker text",
    concurrency: init.concurrency,
    chunk_size: init.chunkSize,
  }
  const writer = createRecordWriter({
    output: init.output,
    provenance: { ...init.provenance, mode },
    budget: new BigInt64Array(init.budget),
    maxBytes: init.maxBytes,
  })
  const inputs: Record<string, unknown> = {}
  let nodes = 0
  let active:
    | {
        key: string
        source: string
        input?: string
        mdast?: unknown
        baseFile?: unknown
        previous: string | null
        next: number
        restore: () => void
      }
    | undefined
  const stage = (phase: Phase, name: string) => {
    const row = init.stages.find((s) => s.phase === phase && s.name === name)
    if (!row || !active || init.stages[active.next]?.id !== row.id) {
      throw new Error(`Observer predecessor/order mismatch at ${phase}/${name}`)
    }
    return row
  }
  const advance = (id: string) => {
    active!.previous = id
    active!.next++
  }
  const snapshot = (phase: Phase, name: string, tree: unknown, file: VFile) => {
    const row = stage(phase, name)
    const n = countNodes(tree)
    writer.write(
      "transform",
      `${active!.key}/${row.id}`,
      {
        stage: row.id,
        previous: active!.previous,
        tree,
        file: { data: file.data },
        identity: { htmlAstIsTree: file.data.htmlAst === tree },
      },
      { nodes: n },
    )
    nodes += n
    advance(row.id)
  }
  return {
    begin(fp: string) {
      if (active) throw new Error("Observer file lifetimes overlap")
      const key = path.relative(ctx.argv.directory, fp).split(path.sep).join("/")
      const raw = fs.readFileSync(fp),
        stat = fs.statSync(fp)
      const clock: { call: string; value: number }[] = []
      const NativeDate = globalThis.Date
      // Record actual clock inputs without changing their values. The proxy retains Date's
      // callable form and prototype; source ASTs and page data are never replaced or cloned.
      const now = (call: string) => {
        const value = NativeDate.now()
        clock.push({ call, value })
        return value
      }
      const observedDate = new Proxy(NativeDate, {
        construct(target, args, newTarget) {
          return Reflect.construct(target, args.length ? args : [now("new Date()")], newTarget)
        },
        get(target, property, receiver) {
          return property === "now"
            ? () => now("Date.now()")
            : Reflect.get(target, property, receiver)
        },
      })
      globalThis.Date = observedDate
      active = {
        key,
        source: raw.toString("utf8"),
        previous: null,
        next: 0,
        restore: () => {
          globalThis.Date = NativeDate
        },
      }
      inputs[key] = {
        sha256: sha(raw),
        size: raw.length,
        birthtimeMs: stat.birthtimeMs,
        mtimeMs: stat.mtimeMs,
        clock,
      }
    },
    text(name: string, text: VFile["value"]) {
      const row = stage("text", name)
      writer.write(
        "transform",
        `${active!.key}/${row.id}`,
        {
          stage: row.id,
          previous: active!.previous,
          text,
        },
        { characters: text.length },
      )
      advance(row.id)
    },
    parsed(tree: unknown, file: VFile) {
      // Only these observer copies are frozen early. file.data.htmlAst remains the LIVE tree.
      active!.mdast = serial(tree)
      active!.input = file.value.toString()
      active!.baseFile = serial({ data: file.data })
      snapshot("parse", "remark-parse", tree, file)
    },
    after(phase: "markdown" | "html" | "bridge", name: string) {
      // New attacher identity at EVERY boundary; unified deduplicates identical functions.
      return () => (tree: unknown, file: VFile) => {
        if (phase === "markdown" && name === "FrontMatter") {
          writer.write(
            "parse",
            active!.key,
            {
              source: active!.source,
              input: active!.input,
              mdast: active!.mdast,
              frontmatter: file.data.frontmatter,
              file: active!.baseFile,
            },
            {
              nodes: countNodes(active!.mdast),
              frontmatter_keys: Object.keys(file.data.frontmatter ?? {}).length,
            },
          )
        }
        snapshot(phase, name, tree, file)
      }
    },
    end(success: boolean) {
      if (!active) return
      const done = active
      active = undefined
      done.restore()
      if (success && done.next !== init.stages.length)
        throw new Error(`${done.key}: incomplete observer boundaries`)
    },
    finish(): ParseObserverReceipt {
      if (active) throw new Error("Observer still has an active file")
      const receipt = writer.receipt() as ParseObserverReceipt
      assertParseReceipt(init, receipt, Object.keys(inputs).length)
      fs.mkdirSync(path.join(init.output, "parts"), { recursive: true })
      fs.writeFileSync(
        path.join(init.output, "parts", `${part}.json`),
        JSON.stringify({
          stages: init.stages,
          mode,
          inputs,
          nodes,
          ...receipt,
        }) + "\n",
        { flag: "wx" },
      )
      return receipt
    },
  }
}

export type ParseObserver = Awaited<ReturnType<typeof createParseObserver>>

export function assertParseReceipt(
  init: ParseObserverInit,
  receipt: ParseObserverReceipt,
  files: number,
) {
  if (
    !receipt ||
    files < 1 ||
    receipt.coverage.parse !== files ||
    receipt.coverage.transform !== files * init.stages.length ||
    receipt.coverage.snapshots !== files * (init.stages.length + 1) ||
    Object.keys(receipt.coverage.by_stage).length !== init.stages.length ||
    init.stages.some((s) => receipt.coverage.by_stage[s.id] !== files) ||
    Object.values(receipt.storage).some((n) => !Number.isSafeInteger(n) || n <= 0)
  ) {
    throw new Error(
      `Incomplete parse observer receipt; expected ${files} files at ${init.stages.length} boundaries`,
    )
  }
}

export function finishParseObservation(
  ctx: BuildCtx,
  init: ParseObserverInit,
  files: number,
  receipts: ParseObserverReceipt[],
) {
  const inputs: Record<string, unknown> = {},
    byStage: Record<string, number> = {}
  let nodes = 0
  let executionMode: Record<string, unknown> | undefined
  const parts = fs.readdirSync(path.join(init.output, "parts")).sort()
  if (parts.length !== receipts.length) throw new Error("Observer part/receipt count mismatch")
  for (const name of parts) {
    const part = JSON.parse(fs.readFileSync(path.join(init.output, "parts", name), "utf8"))
    if (JSON.stringify(part.stages) !== JSON.stringify(init.stages))
      throw new Error("Observer parts disagree on boundary inventory")
    const mode = { ...part.mode, worker: init.concurrency === 1 ? null : "all" }
    if (
      mode.path !== (init.concurrency === 1 ? "main-thread" : "worker-thread") ||
      mode.concurrency !== init.concurrency ||
      mode.chunk_size !== init.chunkSize ||
      (executionMode && JSON.stringify(mode) !== JSON.stringify(executionMode))
    )
      throw new Error("Observer parts disagree on actual execution path")
    executionMode = mode
    for (const [key, value] of Object.entries(part.inputs)) {
      if (Object.hasOwn(inputs, key)) throw new Error(`Duplicate observer input ${key}`)
      inputs[key] = value
    }
    nodes += part.nodes
  }
  const storage = { bytes: 0, uncompressed_bytes: 0, reserved_bytes: 0 }
  let parse = 0,
    transform = 0
  for (const receipt of receipts) {
    parse += receipt.coverage.parse
    transform += receipt.coverage.transform
    for (const [id, count] of Object.entries(receipt.coverage.by_stage))
      byStage[id] = (byStage[id] ?? 0) + count
    for (const key of Object.keys(storage) as (keyof typeof storage)[])
      storage[key] += receipt.storage[key]
  }
  assertParseReceipt(
    init,
    { coverage: { parse, transform, snapshots: parse + transform, by_stage: byStage }, storage },
    files,
  )
  if (
    Object.keys(inputs).length !== files ||
    storage.reserved_bytes !== Number(Atomics.load(new BigInt64Array(init.budget), 0))
  ) {
    throw new Error("Observer file inventory/shared budget disagrees with completed receipts")
  }
  fs.writeFileSync(
    path.join(init.output, "pipeline.json"),
    JSON.stringify(
      {
        schema: "quartz-pipeline-capture-v1",
        provenance: { ...init.provenance, mode: executionMode },
        stages: init.stages,
        allSlugs: ctx.allSlugs,
        inputs,
        coverage: {
          files,
          corpus_files: files,
          snapshots: parse + transform,
          nodes,
          by_stage: byStage,
        },
        storage,
      },
      null,
      2,
    ) + "\n",
    { flag: "wx" },
  )
  console.log(
    `[parse:observer] parse=${parse}/${files} transform=${transform}/${files * init.stages.length} stages=${init.stages.length} bytes=${storage.bytes}`,
  )
}
