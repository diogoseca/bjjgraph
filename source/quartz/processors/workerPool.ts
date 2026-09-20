import { Worker } from "node:worker_threads"
import type { Argv } from "../util/ctx"
import type { FilePath, FullSlug } from "../util/path"
import type { StaticResources } from "../util/resources"

// HOST SIDE only. quartz/worker.ts is the worker-side entry (D-18).
// A fresh pool per phase/build bounds memory and makes plugin/module caches build-local.
export type WorkerInit = {
  buildId: string
  argv: Argv
  allSlugs: FullSlug[]
} & ({ phase: "parse" } | { phase: "emit"; content: SharedArrayBuffer; resources: StaticResources })

export type RenderCoverage = { rendered: number; graphPayloads: number }
export type EmitResult = { files: FilePath[]; coverage: RenderCoverage }

export function workerCount(argv: Argv, files = 512): number {
  // D-17/D-24: deploy omits --concurrency; keep the incumbent 128-file clamp exactly.
  const count = argv.concurrency ?? Math.min(Math.max(Math.round(files / 128), 1), 4)
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`--concurrency must be a positive integer, received ${count}`)
  }
  return count
}

/** Jobs may finish in any order; returned results always retain input order. */
export async function runWorkerTasks<T>(
  init: WorkerInit,
  tasks: unknown[],
  concurrency = workerCount(init.argv),
): Promise<T[]> {
  if (tasks.length === 0) return []
  const count = Math.min(concurrency, tasks.length)
  const workers: Worker[] = []
  const results = new Array<T>(tasks.length)
  let next = 0
  let complete = 0
  try {
    await Promise.all(
      Array.from({ length: count }, () => {
        const entry =
          init.phase === "parse" ? "./transpiled-worker.mjs" : "./transpiled-emit-worker.mjs"
        const worker = new Worker(new URL(entry, import.meta.url), {
          workerData: init,
        })
        workers.push(worker)
        return new Promise<void>((resolve, reject) => {
          let pending: number | undefined
          let finished = false
          const dispatch = () => {
            if (next >= tasks.length) {
              finished = true
              resolve()
              return
            }
            pending = next++
            worker.postMessage({ id: pending, task: tasks[pending] })
          }
          worker.on("error", reject)
          worker.on("exit", (code) => {
            if (!finished) reject(new Error(`Worker exited (${code}) before completing its job`))
          })
          worker.on("message", (message) => {
            if (message.id !== pending) {
              reject(new Error(`Worker returned unexpected job ${message.id}; expected ${pending}`))
              return
            }
            if (message.error) {
              reject(new Error(message.error))
              return
            }
            results[message.id] = message.result as T
            complete++
            dispatch()
          })
          dispatch()
        })
      }),
    )
    if (complete !== tasks.length) {
      throw new Error(`Worker coverage ${complete}/${tasks.length}: incomplete phase`)
    }
    console.log(`[workers:${init.phase}] ${complete}/${tasks.length} jobs on ${count} threads`)
    return results
  } finally {
    // Join EVERY worker even on failure. No background writer may outlive the build lock.
    await Promise.all(workers.map((worker) => worker.terminate()))
  }
}
