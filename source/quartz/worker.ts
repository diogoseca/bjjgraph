import sourceMapSupport from "source-map-support"
import { parentPort, workerData, threadId } from "node:worker_threads"
import { deserialize } from "node:v8"
import cfg from "../quartz.config"
import { Argv, BuildCtx } from "./util/ctx"
import { FilePath, FullSlug } from "./util/path"
import { createFileParser, createProcessor, restoreContent } from "./processors/parse"
import { options } from "./util/sourcemap"
import type { WorkerInit } from "./processors/workerPool"
import type { ProcessedContent } from "./plugins/vfile"
import { getRenderCoverage, resetRenderState } from "./components/renderPage"

sourceMapSupport.install(options)

// WORKER SIDE only. processors/workerPool.ts owns scheduling and termination.
// Keep parseFiles callable for seam captures and the incumbent bootstrap-worker entry.
export async function parseFiles(
  buildId: string,
  argv: Argv,
  fps: FilePath[],
  allSlugs: FullSlug[],
) {
  const ctx: BuildCtx = { buildId, cfg, argv, allSlugs }
  return createFileParser(ctx, fps)(createProcessor(ctx))
}

if (parentPort && workerData) {
  const init = workerData as WorkerInit
  const ctx: BuildCtx = {
    buildId: init.buildId,
    cfg,
    argv: init.argv,
    allSlugs: init.allSlugs,
  }
  // V8 serialization preserves Dates and the shared tree/htmlAst/block references.
  // Every emitter receives ALL content. Chunking it would poison allFiles and roll positions.
  const hydrateStart = performance.now()
  if (init.phase === "emit") {
    console.log(
      `[emit:hydrate:start] thread=${threadId} sharedBytes=${init.content.byteLength} memory=${JSON.stringify(process.memoryUsage())}`,
    )
  }
  const content =
    init.phase === "emit"
      ? restoreContent(deserialize(Buffer.from(init.content)) as ProcessedContent[])
      : []
  if (init.phase === "emit") {
    // rss covers this whole Node process; heapUsed/heapTotal describe this worker isolate.
    console.log(
      `[emit:hydrate:ready] thread=${threadId} pages=${content.length} ${(performance.now() - hydrateStart).toFixed(1)}ms memory=${JSON.stringify(process.memoryUsage())}`,
    )
  }
  parentPort.on("message", async ({ id, task }) => {
    try {
      if (init.phase === "parse") {
        const result = await parseFiles(init.buildId, init.argv, task, init.allSlugs)
        parentPort!.postMessage({ id, result })
      } else {
        const emitter = cfg.plugins.emitters[task as number]
        if (!emitter) throw new Error(`Missing emitter at configured index ${task}`)
        resetRenderState()
        const start = performance.now()
        const files = await emitter.emit(ctx, content, init.resources)
        const coverage = getRenderCoverage()
        console.log(
          `[emit:${emitter.name}] ${files.length} reported paths, ${(performance.now() - start).toFixed(1)}ms, rendered=${coverage.rendered} graphPayloads=${coverage.graphPayloads}`,
        )
        parentPort!.postMessage({ id, result: { files, coverage } })
      }
    } catch (error) {
      const err = error as Error
      parentPort!.postMessage({ id, error: err.stack ?? String(error) })
    }
  })
}
