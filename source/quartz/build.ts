import sourceMapSupport from "source-map-support"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { rimraf } from "rimraf"
import { isGitIgnored } from "globby"
import chokidar from "chokidar"
import { Mutex } from "async-mutex"
import cfg from "../quartz.config"
import { parseMarkdown } from "./processors/parse"
import { filterContent } from "./processors/filter"
import { emitContent } from "./processors/emit"
import { createEmitObserver } from "./processors/emitObserver"
import { FilePath, joinSegments, slugifyFilePath } from "./util/path"
import { Argv, BuildCtx } from "./util/ctx"
import { glob, toPosixPath } from "./util/glob"
import { options } from "./util/sourcemap"

sourceMapSupport.install(options)

async function buildOnce(argv: Argv) {
  const start = performance.now()
  const timings: Record<string, number> = {}
  const phase = async <T>(name: string, fn: () => Promise<T> | T): Promise<T> => {
    const before = performance.now()
    try {
      return await fn()
    } finally {
      timings[name] = performance.now() - before
      console.log(`[phase:${name}] ${timings[name].toFixed(1)}ms`)
    }
  }
  const ctx: BuildCtx = { buildId: randomUUID(), argv, cfg, allSlugs: [] }
  const emitObserver = process.env.BJJ_EMIT_LEDGER_DIR ? await createEmitObserver(ctx) : undefined
  try {
    // The FIRST output mutation, before discovery/parse/emit. Never clean after emit:
    // that would delete post-processor output or leave stale routes from an earlier build.
    await phase("clean", () =>
      rimraf(path.join(argv.output, "*"), { glob: true, maxRetries: 3, backoff: 1.5 }),
    )
    const files = await phase("discover", () =>
      // D-35: dot:false and the '.obsidian' ignore pattern independently exclude that
      // directory. Only dot:false also protects future hidden directories such as .vscode.
      glob("**/*.*", argv.directory, cfg.configuration.ignorePatterns),
    )
    const markdown = files.filter((file) => file.endsWith(".md")).sort()
    console.log(`[discover:coverage] files=${files.length} markdown=${markdown.length}`)
    if (markdown.length === 0) throw new Error(`No Markdown inputs in ${argv.directory}`)
    // Deliberately preserve discovery order here; ambiguous wikilinks take first matches.
    ctx.allSlugs = files.map((file) => slugifyFilePath(file))
    const paths = markdown.map((file) => joinSegments(argv.directory, file) as FilePath)
    const parsed = await phase("parse", () => parseMarkdown(ctx, paths))
    const content = await phase("filter", () => filterContent(ctx, parsed))
    if (content.length === 0) throw new Error("No published pages after filtering")
    const schedule = await phase("emit", () => emitContent(ctx, content))
    // D-V-14: all raw writers have settled here; caller/CLI post-processors have not
    // started. The observer copies and hashes the same bytes before this boundary opens.
    if (emitObserver) {
      await emitObserver.finish(
        schedule,
        {
          all: files.length,
          md: markdown.length,
          parsed: parsed.length,
          published: content.length,
        },
        timings.parse,
      )
    }
    console.log(`[build:coverage] parsed=${parsed.length} published=${content.length}`)
  } finally {
    console.log(`[phase:total] ${(performance.now() - start).toFixed(1)}ms`)
  }
}

export default async function buildQuartz(argv: Argv, mutex: Mutex, clientRefresh: () => void) {
  // getDependencyGraph/depgraph are absent from the new driver. Keep the flag accepted
  // until its coordinated retirement; a full rebuild is the supported correctness path.
  if (argv.fastRebuild)
    console.log("[build] --fastRebuild uses a full rebuild (dependency graph retired)")
  await mutex.runExclusive(() => buildOnce(argv))
  if (!argv.serve) return

  const ignored = await isGitIgnored()
  let pending: ReturnType<typeof setTimeout> | undefined
  let closed = false
  let latest = 0
  let running = Promise.resolve()
  const watcher = chokidar.watch(".", {
    cwd: argv.directory,
    ignoreInitial: true,
    ignored: /(^|[/\\])\./,
  })
  watcher.on("all", (_event, file) => {
    const fp = toPosixPath(file)
    if (ignored(joinSegments(argv.directory, fp))) return
    clearTimeout(pending)
    const generation = ++latest
    pending = setTimeout(() => {
      running = running.then(async () => {
        if (closed || generation !== latest) return
        try {
          await mutex.runExclusive(() => buildOnce(argv))
          clientRefresh()
        } catch (error) {
          console.error("[build] Rebuild failed; waiting for a source change", error)
        }
      })
    }, 75)
  })
  return async () => {
    closed = true
    clearTimeout(pending)
    await watcher.close()
    await running
  }
}
