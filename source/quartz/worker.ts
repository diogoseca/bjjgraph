import sourceMapSupport from "source-map-support"
import { parentPort, workerData, threadId } from "node:worker_threads"
import { deserialize } from "node:v8"
import cfg from "../quartz.config"
import { Argv, BuildCtx } from "./util/ctx"
import { FilePath, FullSlug } from "./util/path"
import { createFileParser, createProcessor, restoreContent } from "./processors/parse"
import { options } from "./util/sourcemap"
import type { EmitShard, EmitTask, WorkerInit } from "./processors/workerPool"
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
  parentPort.on("message", async ({ id, task }) => {
    try {
      if (init.phase === "parse") {
        const result = await parseFiles(init.buildId, init.argv, task, init.allSlugs)
        parentPort!.postMessage({ id, result })
      } else {
        const { emitter: index, content: shared } = task as EmitTask
        const emitter = cfg.plugins.emitters[index]
        if (!emitter?.emitShard)
          throw new Error(`Missing shard emitter at configured index ${index}`)
        const hydrateStart = performance.now()
        console.log(
          `[emit:hydrate:start] thread=${threadId} sharedBytes=${shared.byteLength} memory=${JSON.stringify(process.memoryUsage())}`,
        )
        const shard = deserialize(Buffer.from(shared)) as EmitShard
        const content = restoreContent(shard.content)
        const allFiles = shard.allFiles
        // D-50: restore VFile behavior without cloning its data. Resident roster entries,
        // htmlAst and blocks still alias the same graph as the corresponding live tuple.
        // A future/custom component's unaudited other-page AST read must fail, not silently
        // treat omitted data as absent. Custom layouts default to main-thread full emit.
        for (const { index: page, fields } of shard.omittedTrees) {
          for (const field of fields) {
            Object.defineProperty(allFiles[page], field, {
              enumerable: true,
              get() {
                throw new Error(`Unplanned shard tree read: ${allFiles[page].slug}.${field}`)
              },
            })
          }
        }
        // rss covers the whole Node process; heap figures belong to this worker isolate.
        console.log(
          `[emit:hydrate:ready] thread=${threadId} renderPages=${shard.renderCount} residentPages=${content.length} metadataPages=${allFiles.length} ${(performance.now() - hydrateStart).toFixed(1)}ms memory=${JSON.stringify(process.memoryUsage())}`,
        )
        resetRenderState()
        const start = performance.now()
        const files = await emitter.emitShard(
          ctx,
          content.slice(0, shard.renderCount),
          init.resources,
          allFiles,
        )
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
