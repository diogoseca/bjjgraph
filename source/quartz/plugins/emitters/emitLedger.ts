import { AsyncLocalStorage } from "node:async_hooks"
import fs from "fs"
import path from "path"

/**
 * In-build ATTRIBUTION for the emit seam: which emitter wrote which path.
 *
 * WHY THIS EXISTS AND WHY IT IS ONLY HALF OF A RECORD (D-B-05).
 *
 * The batched golden re-capture must be ONE build. A separate producer pass costs ~9 minutes of
 * emit on top of the build's own, and — the load-bearing reason, not the cost — **attribution is
 * not recoverable from the final output**. A finished tree says what exists, not which emitter
 * wrote it. Every emitter writes into one shared output directory, so the composition is gone the
 * moment the build ends.
 *
 * The symmetric fact is just as important and is why this module deliberately does NOT produce a
 * record on its own: **inventory is not recoverable in-build**. A ledger records what the producer
 * DID, not what EXISTS. For `static.ts` it would record that `fs.cp` was called, not that 4,952
 * files landed — which is exactly the defect V's format rule exists to prevent, since Static
 * returns 9 paths while copying 4,952.
 *
 * So the emit-seam record is joined from two sources, each supplying the half it can:
 *
 *   ATTRIBUTION  <- this ledger, in-build          (not recoverable post-hoc, at any price)
 *   INVENTORY    <- ONE post-build filesystem walk (a producer-side record cannot prove coverage)
 *
 * A path in the walk that no ledger claims is a FINDING, not a rounding error — post-processors
 * write into the same tree. Measured on build0: 15,769 files, 11,097 emitter-claimed, 4,672
 * unclaimed (4,598 `markdown/`, 59 `dev/`, 3 `static/system-guide*`, and the singletons). The
 * unclaimed set is asserted by SHAPE, never by membership: it is F's surface and it moves.
 *
 * WHY AsyncLocalStorage AND NOT A "CURRENT EMITTER" VARIABLE.
 *
 * `processors/emit.ts` runs phase-two emitters CONCURRENTLY through one shared `write()`
 * (`Promise.allSettled`). A module-level `currentEmitter` is the obvious implementation and it
 * misattributes every interleaved write. ALS gives each emitter's async context its own store, so
 * attribution stays exact under full interleaving — verified with three emitters interleaved
 * through one shared writer before this module was written.
 *
 * COST WHEN DISABLED: one boolean test per write. The ledger only activates when
 * `BJJ_EMIT_LEDGER_DIR` is set, so an ordinary build pays essentially nothing and no emitted byte
 * changes either way — this module never touches content, only observes paths.
 *
 * WORKERS: each worker thread has its own module instance and therefore its own ledger, so each
 * flushes a partial file named by thread. The join merges them per emitter.
 */

type Ledger = Map<string, Set<string>>

const store = new AsyncLocalStorage<{ emitter: string }>()
const ledger: Ledger = new Map()

/** Set once at module load: an ordinary build must not pay for a feature it is not using. */
const OUT_DIR = process.env.BJJ_EMIT_LEDGER_DIR
export const enabled = Boolean(OUT_DIR)

function claim(emitter: string, rel: string) {
  let set = ledger.get(emitter)
  if (!set) ledger.set(emitter, (set = new Set()))
  set.add(rel)
}

/**
 * Run an emitter's body inside its own attribution context. Every `record*` call made underneath
 * it — however deeply, however interleaved with other emitters — is attributed to `emitter`.
 */
export function track<T>(emitter: string, fn: () => Promise<T>): Promise<T> {
  if (!enabled) return fn()
  return store.run({ emitter }, fn)
}

/**
 * Claim one output path. `abs` is the filesystem path the emitter wrote; it is stored relative to
 * the output root so it joins against a walk of that root.
 *
 * Silently does nothing outside a `track()` context — that is deliberate: a write from outside an
 * emitter is not misattributed to whichever emitter ran last. Such paths simply stay unclaimed,
 * and the join reports them.
 */
export function recordWrite(outputRoot: string, abs: string) {
  if (!enabled) return
  const ctx = store.getStore()
  if (!ctx) return
  claim(ctx.emitter, path.relative(outputRoot, abs).split(path.sep).join("/"))
}

/**
 * Claim many output paths at once, for the two emitters that bypass `write()` — `static.ts`
 * (`fs.cp` of a whole directory) and `assets.ts` (`copyFile`). Both are stream B's, which is what
 * makes complete attribution possible without a driver hook: 7 of 9 emitters go through
 * `write()`, and these two report their own.
 */
export function recordPaths(rels: string[]) {
  if (!enabled) return
  const ctx = store.getStore()
  if (!ctx) return
  for (const rel of rels) claim(ctx.emitter, rel)
}

/** What this process attributed, as plain data. Empty when disabled. */
export function snapshot(): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const [emitter, set] of ledger) out[emitter] = [...set]
  return out
}

/**
 * Write this process's partial ledger. Called once per process (main thread and each worker), so
 * the filename carries a discriminator; the join merges every part it finds.
 *
 * Returns the path written, or null when disabled — never throws on the disabled path, because a
 * build that is not capturing must not fail because a capture directory is absent.
 */
export function flush(tag: string): string | null {
  if (!OUT_DIR) return null
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const fp = path.join(OUT_DIR, `ledger-${tag}.json`)
  const data = snapshot()
  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]))
  fs.writeFileSync(fp, JSON.stringify({ tag, counts, claims: data }), "utf8")
  console.log(
    `[emit:ledger] ${tag}: ${Object.keys(data).length} emitter(s), ` +
      `${Object.values(data).reduce((n, v) => n + v.length, 0)} claimed path(s) -> ${fp}`,
  )
  return fp
}

// Flush without a driver hook. The build has no natural "emit finished" callback that B owns, and
// asking S1 for one would put a capture concern in the driver; `process.on("exit")` fires once per
// process — main thread and each worker — which is exactly the granularity the partial ledgers
// need. Sync-only is fine here: the payload is a few hundred KB of paths.
if (enabled) {
  process.on("exit", () => {
    try {
      flush(`${process.pid}-${process.env.BJJ_EMIT_LEDGER_TAG ?? "main"}`)
    } catch (err) {
      // A capture must never be able to fail a build. Say so loudly instead.
      console.log(`[emit:ledger] FAILED to flush: ${(err as Error).message}`)
    }
  })
}
