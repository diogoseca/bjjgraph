import { serialize } from "node:v8"
import { getStaticResourcesFromPlugins } from "../plugins"
import { ProcessedContent } from "../plugins/vfile"
import { BuildCtx } from "../util/ctx"
import { getRenderCoverage, resetRenderState } from "../components/renderPage"
import { EmitResult, runWorkerTasks, workerCount } from "./workerPool"

export async function emitContent(ctx: BuildCtx, content: ProcessedContent[]) {
  // D-49: components read OTHER pages through allFiles (dates/title for sorting, tags
  // for indexes, slugs for navigation). Every entry must be fully transformed before emit;
  // never lazily fill metadata only for the page currently rendering.
  const { argv, cfg } = ctx
  const resources = getStaticResourcesFromPlugins(ctx)
  const required = ["ComponentResources", "Static"]
  for (const name of required) {
    const matches = cfg.plugins.emitters.filter((emitter) => emitter.name === name).length
    console.log(`[emit:coverage] ${name} matched ${matches}`)
    if (matches !== 1) throw new Error(`Expected exactly one ${name} emitter, received ${matches}`)
  }

  const run = async (index: number) => {
    const emitter = cfg.plugins.emitters[index]
    const start = performance.now()
    const files = await emitter.emit(ctx, content, resources)
    console.log(
      `[emit:${emitter.name}] ${files.length} reported paths, ${(performance.now() - start).toFixed(1)}ms`,
    )
    return files
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
    resetRenderState()
    results.push({ files: await run(index), coverage: getRenderCoverage() })
  }
  const remaining = ordered.filter((index) => !required.includes(cfg.plugins.emitters[index].name))
  const concurrency = workerCount(argv, content.length)
  console.log(
    `[emit] path=${concurrency === 1 ? "main" : "workers"} concurrency=${concurrency} emitters=${remaining.length}`,
  )
  if (concurrency === 1) {
    // One JavaScript thread still starts every phase-two emitter concurrently, as the
    // frozen ABI requires. Counters belong to the phase, not overlapping emitter calls.
    resetRenderState()
    const settled = await Promise.allSettled(remaining.map(run))
    // Join every writer before a failure releases the build lock or permits cleanup.
    const failure = settled.find((result) => result.status === "rejected")
    if (failure?.status === "rejected") throw failure.reason
    const files = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    results.push({ files, coverage: getRenderCoverage() })
  } else {
    // Serialize once into shared bytes, then deserialize once per bounded emitter worker.
    // JSON would erase Dates and AST aliases; N postMessage copies duplicate host memory.
    // D-50: htmlAst === tree and blocks refer into that SAME tree, including later plugin
    // mutations. V8 serializes the whole object graph; independent field copies break it.
    const transportStart = performance.now()
    console.log(
      `[emit:transport:start] pages=${content.length} memory=${JSON.stringify(process.memoryUsage())}`,
    )
    const bytes = serialize(content)
    const shared = new SharedArrayBuffer(bytes.length)
    Buffer.from(shared).set(bytes)
    console.log(`[emit:transport] ${content.length} complete pages, ${bytes.length} shared bytes`)
    console.log(
      `[emit:transport:ready] ${(performance.now() - transportStart).toFixed(1)}ms memory=${JSON.stringify(process.memoryUsage())}`,
    )
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
