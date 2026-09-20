import { serialize } from "node:v8"
import { visit } from "unist-util-visit"
import type { Element } from "hast"
import type { FullSlug } from "../util/path"
import { getStaticResourcesFromPlugins } from "../plugins"
import { ProcessedContent } from "../plugins/vfile"
import { BuildCtx } from "../util/ctx"
import { getRenderCoverage, resetRenderState } from "../components/renderPage"
import { EmitResult, EmitShard, EmitTask, runWorkerTasks, workerCount } from "./workerPool"

function partitionContent(content: ProcessedContent[], concurrency: number): EmitShard[] {
  // Match ContentPage's slugMap exactly: last duplicate wins. The caller falls back to
  // main for duplicate output slugs, but lookup itself must never invent a new order.
  const bySlug = new Map(content.map(([, file], index) => [file.data.slug, index]))
  const dependencies = content.map(([tree]) => {
    const targets = new Set<number>()
    // Read the FINAL HAST selector used by renderPage, not Markdown or file.data.links.
    visit(tree, "element", (node: Element) => {
      if (
        node.tagName === "blockquote" &&
        (node.properties?.className as string[] | undefined)?.includes("transclude")
      ) {
        const target = (node.children[0] as Element | undefined)?.properties?.["data-slug"]
        const index = bySlug.get(target as FullSlug)
        if (index !== undefined) targets.add(index)
      }
    })
    return targets
  })
  const shards: EmitShard[] = []
  const size = Math.ceil(content.length / Math.min(concurrency, content.length))
  for (let start = 0; start < content.length; start += size) {
    const owned = content.slice(start, start + size)
    const resident = new Set(owned.map((_, offset) => start + offset))
    // Whole target tuples preserve heading ranges, block aliases and nested transclusions.
    // Set iteration sees newly added members; cycles terminate without flattening trees.
    for (const index of resident) {
      for (const target of dependencies[index]) resident.add(target)
    }
    const omittedTrees: EmitShard["omittedTrees"] = []
    const allFiles = content.map(([, file], index) => {
      if (resident.has(index)) return file.data
      const { htmlAst, blocks, ...metadata } = file.data
      const fields: ("htmlAst" | "blocks")[] = []
      if (htmlAst !== undefined) fields.push("htmlAst")
      if (blocks !== undefined) fields.push("blocks")
      omittedTrees.push({ index, fields })
      // D-49: EVERY other metadata field, including unknown extensions and Dates, stays
      // eager. Only nonresident trees are omitted, with throwing accessors in the worker.
      return metadata
    })
    shards.push({
      content: Array.from(resident, (index) => content[index]),
      renderCount: owned.length,
      allFiles,
      omittedTrees,
    })
  }
  return shards
}

function serializeShard(shard: EmitShard, emitter: number, shardIndex: number): EmitTask {
  // One shard graph preserves tree === data.htmlAst, blocks and roster/tuple identity.
  // Partition BEFORE serialization: no worker first hydrates the complete corpus.
  const bytes = serialize(shard)
  const shared = new SharedArrayBuffer(bytes.length)
  Buffer.from(shared).set(bytes)
  console.log(
    `[emit:transport:shard] emitter=${emitter} renderPages=${shard.renderCount} residentPages=${shard.content.length} metadataPages=${shard.allFiles.length} sharedBytes=${bytes.length}`,
  )
  return { emitter, content: shared, shardIndex }
}

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
    // Global emitters retain the original complete corpus on main. Only the opt-in
    // ContentPage loop is partitioned; feeding shards into ordinary emit() would corrupt
    // folder/tag inventories, allFiles, and ContentIndex (including rssFullHtml).
    const contentPages = remaining.filter(
      (index) => cfg.plugins.emitters[index].name === "ContentPage",
    )
    const uniqueSlugs = new Set(content.map(([, file]) => file.data.slug)).size === content.length
    const sharded =
      contentPages.length === 1 && uniqueSlugs && content.length > 0
        ? contentPages.filter(
            (index) => typeof cfg.plugins.emitters[index].emitShard === "function",
          )
        : []
    // Duplicate output slugs keep the incumbent loop/write ordering on main. Custom
    // layouts without the audited tree-read capability also retain full-content emit().
    const main = remaining.filter((index) => !sharded.includes(index))
    console.log(
      `[emit:plan] shardEmitters=${sharded.length} mainEmitters=${main.length} uniqueSlugs=${uniqueSlugs}`,
    )
    const transportStart = performance.now()
    console.log(
      `[emit:transport:start] pages=${content.length} memory=${JSON.stringify(process.memoryUsage())}`,
    )
    const tasks = sharded.flatMap((index) =>
      partitionContent(content, concurrency).map((shard, shardIndex) =>
        serializeShard(shard, index, shardIndex),
      ),
    )
    const totalBytes = tasks.reduce((sum, task) => sum + task.content.byteLength, 0)
    const maxBytes = tasks.reduce((max, task) => Math.max(max, task.content.byteLength), 0)
    console.log(
      `[emit:transport] shards=${tasks.length} totalBytes=${totalBytes} maxShardBytes=${maxBytes}`,
    )
    console.log(
      `[emit:transport:ready] ${(performance.now() - transportStart).toFixed(1)}ms memory=${JSON.stringify(process.memoryUsage())}`,
    )
    resetRenderState()
    const settled = await Promise.allSettled([
      runWorkerTasks<EmitResult>(
        {
          phase: "emit",
          buildId: ctx.buildId,
          argv,
          allSlugs: ctx.allSlugs,
          resources,
        },
        tasks,
        concurrency,
      ),
      ...main.map(run),
    ])
    // Wait for both the worker pool and every main writer, even if either fails.
    const failure = settled.find((result) => result.status === "rejected")
    if (failure?.status === "rejected") throw failure.reason
    const workerResult = settled[0] as PromiseFulfilledResult<EmitResult[]>
    results.push(...workerResult.value)
    const files = settled
      .slice(1)
      .flatMap((result) =>
        result.status === "fulfilled" ? (result.value as EmitResult["files"]) : [],
      )
    results.push({ files, coverage: getRenderCoverage() })
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
