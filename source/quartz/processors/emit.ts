import { serialize } from "node:v8"
import { getStaticResourcesFromPlugins } from "../plugins"
import { ProcessedContent } from "../plugins/vfile"
import { BuildCtx } from "../util/ctx"
import { getRenderCoverage, resetRenderState } from "../components/renderPage"
import { EmitResult, runWorkerTasks, workerCount } from "./workerPool"

export async function emitContent(ctx: BuildCtx, content: ProcessedContent[]) {
  const { argv, cfg } = ctx
  const resources = getStaticResourcesFromPlugins(ctx)
  const required = ["ComponentResources", "Static"]
  for (const name of required) {
    const matches = cfg.plugins.emitters.filter((emitter) => emitter.name === name).length
    console.log(`[emit:coverage] ${name} matched ${matches}`)
    if (matches !== 1) throw new Error(`Expected exactly one ${name} emitter, received ${matches}`)
  }

  const run = async (index: number): Promise<EmitResult> => {
    const emitter = cfg.plugins.emitters[index]
    resetRenderState()
    const start = performance.now()
    const files = await emitter.emit(ctx, content, resources)
    const coverage = getRenderCoverage()
    console.log(
      `[emit:${emitter.name}] ${files.length} reported paths, ${(performance.now() - start).toFixed(1)}ms, rendered=${coverage.rendered} graphPayloads=${coverage.graphPayloads}`,
    )
    return { files, coverage }
  }

  const ordered = cfg.plugins.emitters.map((_, index) => index)
  const results: EmitResult[] = []
  // D-35: fs.cp merges; it does not delete generated contentIndex files. This barrier
  // preserves incumbent scheduling and prevents concurrent writes under output/static/.
  // That race is currently dormant: cdnCaching:true avoids ComponentResources' font writes.
  // Preserve the config-relative order of these two, and finish BOTH before parallel emit.
  for (const index of ordered.filter((index) =>
    required.includes(cfg.plugins.emitters[index].name),
  )) {
    results.push(await run(index))
  }
  const remaining = ordered.filter((index) => !required.includes(cfg.plugins.emitters[index].name))
  const concurrency = workerCount(argv, content.length)
  console.log(
    `[emit] path=${concurrency === 1 ? "main" : "workers"} concurrency=${concurrency} emitters=${remaining.length}`,
  )
  if (concurrency === 1) {
    // Keep the explicit single-thread mode useful for fixtures and parity diagnosis.
    // Parallel I/O is unnecessary here; deterministic complete emitter calls share no counters.
    for (const index of remaining) results.push(await run(index))
  } else {
    // Serialize once into shared bytes, then deserialize once per bounded emitter worker.
    // JSON would erase Dates and AST aliases; N postMessage copies duplicate host memory.
    const bytes = serialize(content)
    const shared = new SharedArrayBuffer(bytes.length)
    Buffer.from(shared).set(bytes)
    console.log(`[emit:transport] ${content.length} complete pages, ${bytes.length} shared bytes`)
    results.push(
      ...(await runWorkerTasks<EmitResult>(
        {
          phase: "emit",
          buildId: ctx.buildId,
          argv,
          allSlugs: ctx.allSlugs,
          content: shared,
          resources,
        },
        remaining,
        concurrency,
      )),
    )
  }
  const emitted = results.reduce((count, result) => count + result.files.length, 0)
  const rendered = results.reduce((count, result) => count + result.coverage.rendered, 0)
  const graphPayloads = results.reduce((count, result) => count + result.coverage.graphPayloads, 0)
  console.log(`[render:coverage] rendered=${rendered} graphPayloads=${graphPayloads}`)
  // A small vault can legitimately have no graph-mapped routes. loadGraphData separately
  // requires a positive input-entry count; do not demand graph payloads from 404/tag workers.
  if (content.length > 0 && rendered === 0) throw new Error("Render coverage is zero")
  console.log(`Emitted ${emitted} reported paths to ${argv.output}; filesystem census is separate`)
}
