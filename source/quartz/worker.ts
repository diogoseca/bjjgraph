import sourceMapSupport from "source-map-support"
import { parentPort, workerData, threadId } from "node:worker_threads"
import { deserialize } from "node:v8"
import { visit } from "unist-util-visit"
import type { Element, Node } from "hast"
import cfg from "../quartz.config"
import { Argv, BuildCtx } from "./util/ctx"
import { FilePath, FullSlug } from "./util/path"
import { createFileParser, createProcessor, restoreContent } from "./processors/parse"
import { options } from "./util/sourcemap"
import type { EmitShard, EmitTask, WorkerInit } from "./processors/workerPool"
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
  gitPublicationDates?: Record<string, string>,
  gitModifiedDates?: Record<string, string>,
  gitModifiedDatesFromMerge?: Record<string, true>,
) {
  // Legacy four-argument callers leave these undefined and retain transformer fallbacks.
  // Native parse workers receive the host's complete maps, including merge-origin flags.
  const ctx: BuildCtx = {
    buildId,
    cfg,
    argv,
    allSlugs,
    gitPublicationDates,
    gitModifiedDates,
    gitModifiedDatesFromMerge,
  }
  return createFileParser(ctx, fps)(createProcessor(ctx))
}

function validateEmitShard(
  init: Extract<WorkerInit, { phase: "emit" }>,
  task: EmitTask,
  shard: EmitShard,
  content: ProcessedContent[],
) {
  function fail(reason: string): never {
    throw new Error(`Emit shard ${task.shardIndex}: ${reason}`)
  }
  if (!Number.isSafeInteger(task.shardIndex) || task.shardIndex < 0) {
    fail("invalid shard index")
  }
  if (!Array.isArray(init.corpus) || !Array.isArray(shard.allFiles)) {
    fail("missing original corpus manifest or metadata roster")
  }
  const allFiles = shard.allFiles
  if (allFiles.length !== init.corpus.length) {
    fail(`metadata roster length ${allFiles.length}, expected ${init.corpus.length}`)
  }
  const corpusBySlug = new Map<FullSlug, number>()
  for (const [index, entry] of init.corpus.entries()) {
    if (typeof entry.slug !== "string" || !entry.slug || corpusBySlug.has(entry.slug)) {
      fail(`invalid or duplicate corpus identity at index ${index}`)
    }
    if (allFiles[index]?.slug !== entry.slug) {
      fail(`metadata roster identity at index ${index}, expected ${entry.slug}`)
    }
    if (
      !Array.isArray(entry.treeFields) ||
      new Set(entry.treeFields).size !== entry.treeFields.length ||
      entry.treeFields.some((field) => field !== "htmlAst" && field !== "blocks")
    ) {
      fail(`invalid tree-field manifest for ${entry.slug}`)
    }
    corpusBySlug.set(entry.slug, index)
  }
  if (!Array.isArray(task.owned) || task.owned.length === 0) {
    fail("owned output identities must be nonempty")
  }
  if (
    !Number.isSafeInteger(shard.renderCount) ||
    shard.renderCount <= 0 ||
    shard.renderCount !== task.owned.length ||
    shard.renderCount > content.length
  ) {
    fail(`owned tuple count ${shard.renderCount}, expected ${task.owned.length}`)
  }
  if (new Set(task.owned).size !== task.owned.length) {
    fail("duplicate owned output identity")
  }
  for (const [index, slug] of task.owned.entries()) {
    if (!corpusBySlug.has(slug) || content[index]?.[1].data.slug !== slug) {
      fail(`owned tuple identity at index ${index}, expected ${slug}`)
    }
  }

  const residentBySlug = new Map<FullSlug, ProcessedContent>()
  for (const tuple of content) {
    const [tree, file] = tuple
    const slug = file.data.slug!
    const index = corpusBySlug.get(slug)
    if (index === undefined || residentBySlug.has(slug)) {
      fail(`unknown or duplicate resident tuple ${slug}`)
    }
    if (file.data !== allFiles[index]) {
      fail(`resident tuple ${slug} must alias its metadata roster entry`)
    }
    for (const field of init.corpus[index].treeFields) {
      if (file.data[field] === undefined) fail(`resident tuple ${slug} is missing ${field}`)
      if (field === "htmlAst" && file.data.htmlAst !== tree) {
        fail(`htmlAst must alias the live worker tree: ${slug}`)
      }
      if (field === "blocks") {
        if (!file.data.blocks || typeof file.data.blocks !== "object") {
          fail(`resident tuple ${slug} has invalid blocks`)
        }
        const blocks = Object.values(file.data.blocks)
        if (blocks.length > 0) {
          const liveNodes = new Set<Node>()
          visit(tree, (node) => {
            liveNodes.add(node)
          })
          for (const block of blocks) {
            if (!liveNodes.has(block)) {
              fail(`block must alias a node in the live worker tree: ${slug}`)
            }
          }
        }
      }
    }
    residentBySlug.set(slug, tuple)
  }

  // Rewalk the received final HAST independently of the planner's dependency set.
  // Existing targets must be resident; genuinely absent targets retain renderPage's
  // unresolved-link behavior. Traverse whole target tuples, including nested embeds.
  const reachable = new Set(task.owned)
  const expectedTargets = new Set<FullSlug>()
  const resolvedTargets = new Set<FullSlug>()
  let missing = 0
  let inspectedTrees = 0
  let inspectedNodes = 0
  let references = 0
  for (const slug of reachable) {
    const tuple = residentBySlug.get(slug)
    if (!tuple) fail(`missing owned or reachable tuple ${slug}`)
    inspectedTrees++
    // Count the root too: empty Markdown still has an inspected tree. A target
    // count of 0/0 is meaningful only with evidence that the scan actually ran.
    visit(tuple[0], (node) => {
      inspectedNodes++
      if (node.type !== "element") return
      const element = node as Element
      if (
        element.tagName !== "blockquote" ||
        !((element.properties?.className ?? []) as string[]).includes("transclude")
      ) {
        return
      }
      references++
      const target = (element.children[0] as Element | undefined)?.properties?.[
        "data-slug"
      ] as FullSlug
      if (!corpusBySlug.has(target)) {
        missing++
        return
      }
      expectedTargets.add(target)
      if (!residentBySlug.has(target)) {
        fail(`missing existing transclusion target ${target} referenced by ${slug}`)
      }
      resolvedTargets.add(target)
      reachable.add(target)
    })
  }
  if (inspectedTrees !== reachable.size || inspectedNodes < inspectedTrees) {
    fail(
      `transclusion scan incomplete: trees=${inspectedTrees}/${reachable.size} nodes=${inspectedNodes}`,
    )
  }
  for (const slug of residentBySlug.keys()) {
    if (!reachable.has(slug)) fail(`extra resident tuple ${slug} is neither owned nor reachable`)
  }

  // Validate the planner's descriptors, but derive access guards from the independent
  // manifest. Dropping an omission descriptor must never make a missing tree read silent.
  if (!Array.isArray(shard.omittedTrees)) fail("missing omitted-tree descriptors")
  const omissions = new Map<number, Set<"htmlAst" | "blocks">>()
  for (const { index, fields } of shard.omittedTrees) {
    if (
      !Number.isSafeInteger(index) ||
      index < 0 ||
      index >= init.corpus.length ||
      omissions.has(index) ||
      residentBySlug.has(init.corpus[index].slug) ||
      !Array.isArray(fields)
    ) {
      fail(`invalid omitted-tree descriptor at index ${index}`)
    }
    const expected = init.corpus[index].treeFields
    if (
      fields.length !== expected.length ||
      new Set(fields).size !== fields.length ||
      fields.some((field) => !expected.includes(field))
    ) {
      fail(`omitted-tree fields do not match manifest for ${init.corpus[index].slug}`)
    }
    omissions.set(index, new Set(fields))
  }
  for (const [index, entry] of init.corpus.entries()) {
    if (residentBySlug.has(entry.slug)) continue
    if (!omissions.has(index)) fail(`missing omitted-tree descriptor for ${entry.slug}`)
    for (const field of ["htmlAst", "blocks"] as const) {
      if (allFiles[index][field] !== undefined) {
        fail(`unexpected nonresident tree ${entry.slug}.${field}`)
      }
    }
    for (const field of entry.treeFields) {
      Object.defineProperty(allFiles[index], field, {
        enumerable: true,
        get() {
          throw new Error(`Unplanned shard tree read: ${entry.slug}.${field}`)
        },
      })
    }
  }
  const targetStatus =
    expectedTargets.size > 0
      ? "resolved"
      : references === 0
        ? "none:no-transclusion-references"
        : "none:all-references-unresolved"
  console.log(
    `[emit:coverage:shard] shard=${task.shardIndex} owned=${shard.renderCount}/${task.owned.length} tuples=${residentBySlug.size}/${reachable.size} targets=${resolvedTargets.size}/${expectedTargets.size} missing=${missing} inspectedTrees=${inspectedTrees}/${reachable.size} inspectedNodes=${inspectedNodes} references=${references} targetStatus=${targetStatus}`,
  )
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
        const result = await parseFiles(
          init.buildId,
          init.argv,
          task,
          init.allSlugs,
          init.gitPublicationDates,
          init.gitModifiedDates,
          init.gitModifiedDatesFromMerge,
        )
        parentPort!.postMessage({ id, result })
      } else {
        const emitTask = task as EmitTask
        const { emitter: index, content: shared, shardIndex } = emitTask
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
        validateEmitShard(init, emitTask, shard, content)
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
          shardIndex,
        )
        const coverage = getRenderCoverage()
        if (files.length !== emitTask.owned.length || coverage.rendered !== emitTask.owned.length) {
          throw new Error(
            `Emit shard ${shardIndex}: completed paths=${files.length} rendered=${coverage.rendered}, expected owned=${emitTask.owned.length}`,
          )
        }
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
