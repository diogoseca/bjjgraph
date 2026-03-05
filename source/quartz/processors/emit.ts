import { PerfTimer } from "../util/perf"
import { getStaticResourcesFromPlugins } from "../plugins"
import { ProcessedContent } from "../plugins/vfile"
import { QuartzLogger } from "../util/log"
import { trace } from "../util/trace"
import { BuildCtx } from "../util/ctx"

export async function emitContent(ctx: BuildCtx, content: ProcessedContent[]) {
  const { argv, cfg } = ctx
  const perf = new PerfTimer()
  const log = new QuartzLogger(ctx.argv.verbose)

  log.start(`Emitting output files`)

  let emittedFiles = 0
  const staticResources = getStaticResourcesFromPlugins(ctx)

  // Run ComponentResources and Static first (they produce shared output dirs),
  // then run all remaining emitters in parallel
  const sequentialNames = new Set(["ComponentResources", "Static"])
  const sequentialEmitters = cfg.plugins.emitters.filter((e) => sequentialNames.has(e.name))
  const otherEmitters = cfg.plugins.emitters.filter((e) => !sequentialNames.has(e.name))

  const runEmitter = async (emitter: (typeof cfg.plugins.emitters)[0]) => {
    const emitterPerf = ctx.argv.verbose ? new PerfTimer() : null
    try {
      const emitted = await emitter.emit(ctx, content, staticResources)

      if (ctx.argv.verbose) {
        console.log(`[emit:${emitter.name}] ${emitted.length} files in ${emitterPerf!.timeSince()}`)
      }

      return emitted.length
    } catch (err) {
      trace(`Failed to emit from plugin \`${emitter.name}\``, err as Error)
      return 0
    }
  }

  // Phase 1: Sequential emitters (shared output dirs, must complete first)
  for (const emitter of sequentialEmitters) {
    emittedFiles += await runEmitter(emitter)
  }

  // Phase 2: All other emitters in parallel
  const results = await Promise.all(otherEmitters.map(runEmitter))
  for (const count of results) {
    emittedFiles += count
  }

  log.end(`Emitted ${emittedFiles} files to \`${argv.output}\` in ${perf.timeSince()}`)
}
