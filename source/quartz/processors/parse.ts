import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { Processor, unified } from "unified"
import { Root as MDRoot } from "remark-parse/lib"
import { Root as HTMLRoot } from "hast"
import { ProcessedContent } from "../plugins/vfile"
import { PerfTimer } from "../util/perf"
import { read } from "to-vfile"
import { FilePath, slugifyFilePath } from "../util/path"
import path from "path"
import { QuartzLogger } from "../util/log"
import { VFile } from "vfile"
import { runWorkerTasks, workerCount } from "./workerPool"
import { BuildCtx } from "../util/ctx"
import { gitDateMaps } from "../util/publication"
import type { ParseObserver, ParseObserverReceipt } from "./parseObserver"

export type QuartzProcessor = Processor<MDRoot, MDRoot, HTMLRoot>
export function createProcessor(ctx: BuildCtx, observer?: ParseObserver): QuartzProcessor {
  const transformers = ctx.cfg.plugins.transformers

  return (
    unified()
      // base Markdown -> MD AST
      .use(remarkParse)
      // D-57: register EVERY markdown plugin before processor.parse(), below. Some
      // (remarkFrontmatter) extend tokenization; post-parse registration treats YAML as body.
      // MD AST -> MD AST transforms
      .use(
        transformers
          .filter((p) => p.markdownPlugins)
          .flatMap((plugin) => [
            ...plugin.markdownPlugins!(ctx),
            ...(observer ? [observer.after("markdown", plugin.name)] : []),
          ]),
      )
      // MD AST -> HTML AST
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(observer ? [observer.after("bridge", "remark-rehype")] : [])
      // HTML AST -> HTML AST transforms
      .use(
        transformers
          .filter((p) => p.htmlPlugins)
          .flatMap((plugin) => [
            ...plugin.htmlPlugins!(ctx),
            ...(observer ? [observer.after("html", plugin.name)] : []),
          ]),
      )
  )
}

function* chunks<T>(arr: T[], n: number) {
  for (let i = 0; i < arr.length; i += n) {
    yield arr.slice(i, i + n)
  }
}

export function createFileParser(ctx: BuildCtx, fps: FilePath[], observer?: ParseObserver) {
  const { argv, cfg } = ctx
  return async (processor: QuartzProcessor) => {
    const res: ProcessedContent[] = []
    for (const fp of fps) {
      let observedComplete = false
      try {
        observer?.begin(fp)
        const perf = new PerfTimer()
        const file = await read(fp)

        // strip leading and trailing whitespace
        file.value = file.value.toString().trim()

        // Text -> Text transforms
        for (const plugin of cfg.plugins.transformers.filter((p) => p.textTransform)) {
          file.value = plugin.textTransform!(ctx, file.value.toString())
          observer?.text(plugin.name, file.value)
        }

        // base data properties that plugins may use
        file.data.filePath = file.path as FilePath
        file.data.relativePath = path.posix.relative(argv.directory, file.path) as FilePath
        file.data.slug = slugifyFilePath(file.data.relativePath)

        const ast = processor.parse(file)
        observer?.parsed(ast, file)
        const newAst = await processor.run(ast, file)
        res.push([newAst, file])
        observedComplete = true

        if (argv.verbose) {
          console.log(`[process] ${fp} -> ${file.data.slug} (${perf.timeSince()})`)
        }
      } catch (err) {
        throw new Error(`Failed to process \`${fp}\``, { cause: err })
      } finally {
        observer?.end(observedComplete)
      }
    }

    return res
  }
}

/** Rehydrate VFile methods after native structured cloning; preserve AST/Data aliases and Dates. */
export function restoreContent(content: ProcessedContent[]): ProcessedContent[] {
  return content.map(([tree, file]) => [tree, new VFile(file)])
}

export async function parseMarkdown(ctx: BuildCtx, fps: FilePath[]): Promise<ProcessedContent[]> {
  const perf = new PerfTimer()
  const log = new QuartzLogger(ctx.argv.verbose)
  // D-17/D-24: default = clamp(round(files/128), 1, 4), exactly as before. Deploy omits
  // --concurrency while root build passes 4; on this corpus both must select workers.
  // Explicit 1 uses the MAIN resource loader; workers use D-22's empty-text loader.
  const concurrency = workerCount(ctx.argv, fps.length)
  console.log(
    `[parse] path=${concurrency === 1 ? "main" : "workers"} concurrency=${concurrency} files=${fps.length}`,
  )
  log.start(`Parsing input files`)
  let summary: string | undefined
  try {
    // Disabled observers do not load the writer, inspect inputs, or touch capture storage.
    const observation = process.env.BJJ_PARSE_OBSERVER ? await import("./parseObserver") : undefined
    const size = Math.max(1, Math.min(128, Math.ceil(fps.length / concurrency)))
    const observerInit = observation?.prepareParseObserver(
      ctx,
      concurrency,
      concurrency === 1 ? fps.length : size,
    )
    const receipts: ParseObserverReceipt[] = []
    // X-01: collect once on the host for both paths (including rebuilds). Repeating
    // history walks in workers reintroduces per-worker Git contention (D-197).
    if (ctx.cfg.plugins.transformers.some((plugin) => plugin.name === "CreatedModifiedDate")) {
      const dates = await gitDateMaps(path.resolve(ctx.argv.directory))
      ctx.gitPublicationDates = dates.published
      ctx.gitModifiedDates = dates.modified
      ctx.gitModifiedDatesFromMerge = dates.modifiedFromMerge
    }
    let result: ProcessedContent[]
    if (concurrency === 1) {
      const observer = observerInit
        ? await observation!.createParseObserver(ctx, observerInit, "main")
        : undefined
      result = await createFileParser(ctx, fps, observer)(createProcessor(ctx, observer))
      if (observer) receipts.push(observer.finish())
    } else {
      const groups = [...chunks(fps, size)]
      const results = await runWorkerTasks<ProcessedContent[]>(
        {
          phase: "parse",
          observer: observerInit,
          buildId: ctx.buildId,
          argv: ctx.argv,
          allSlugs: ctx.allSlugs,
          gitPublicationDates: ctx.gitPublicationDates,
          gitModifiedDates: ctx.gitModifiedDates,
          gitModifiedDatesFromMerge: ctx.gitModifiedDatesFromMerge,
        },
        groups,
        concurrency,
        observerInit
          ? (receipt, id) => {
              observation!.assertParseReceipt(observerInit, receipt!, groups[id].length)
              receipts.push(receipt!)
            }
          : undefined,
      )
      result = restoreContent(results.flat())
    }
    if (result.length !== fps.length) {
      throw new Error(`Parse coverage ${result.length}/${fps.length}: refusing a partial site`)
    }
    if (observerInit) observation!.finishParseObservation(ctx, observerInit, fps.length, receipts)
    summary = `Parsed ${result.length}/${fps.length} Markdown files in ${perf.timeSince()}`
    return result
  } finally {
    // Serve mode can recover from parse failures; its terminal spinner must not survive one.
    log.end(summary)
  }
}
