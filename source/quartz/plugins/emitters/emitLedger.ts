import { AsyncLocalStorage } from "node:async_hooks"
import { threadId } from "node:worker_threads"
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
 * WORKERS: THREE DEFECTS, ONE MEASURED FIX (V's review + D-B-08).
 *
 * The first version of this module flushed once, from `process.on("exit")`, to a file named
 * `ledger-<pid>-<tag>.json`. Every clause of that sentence was wrong for the environment it runs
 * in, and the three faults compound in the direction that hides them:
 *
 *   1. NAME COLLISION. `processors/workerPool.ts` uses `node:worker_threads`, so workers are
 *      THREADS and share `process.pid`. Every thread wrote the SAME filename. Records are not
 *      merged by that — they are destroyed, before anything can count them, and the shortfall
 *      reads as "an emitter wrote less" rather than "the ledger lost data".
 *   2. THE JOIN READ ONLY THE MAIN SNAPSHOT — an in-memory `snapshot()` call, so even parts that
 *      did survive on disk were never opened.
 *   3. AND THE ONE THAT MAKES THE FIRST TWO MOOT: `runWorkerTasks` ends every worker with
 *      `worker.terminate()`, which is FORCEFUL. **Measured, not assumed: a worker's
 *      `process.on("exit")` handler does not run under terminate() — 0 files written of 1
 *      expected.** So worker claims were never persisted AT ALL. Fixing the name alone would have
 *      changed nothing, and would have looked like a fix.
 *
 * THE FIX IS STRUCTURAL, NOT A BETTER FLUSH POINT. There is no moment this module owns that is
 * guaranteed to precede a forceful terminate, so it must never depend on one:
 *
 *   * each thread appends to ITS OWN part, keyed by pid AND threadId (0 is main);
 *   * the part is APPEND-ONLY NDJSON, written as claims accrue. A rewrite-the-whole-map flush is
 *     O(paths) per call and therefore O(paths^2) over a build; appending a delta is O(new paths);
 *   * a delta is appended when each `track()` COMPLETES, which is strictly before the worker posts
 *     its result and therefore strictly before the host can terminate it. Nothing is in flight at
 *     the moment of termination because nothing waits for exit.
 *
 * The join reads every part and merges. A thread that claimed nothing still writes its part, so
 * "no part" and "an empty part" stay distinguishable — absence must not be able to look like zero.
 */

/**
 * ORDERED, DUPLICATE-PRESERVING. Not a Set, and that is the point (V's finding 3 and 6).
 *
 * Resource order is BYTE-SIGNIFICANT: first-seen order across `getQuartzComponents` drives
 * deduplication and therefore bundle bytes. A Set collapses the duplicates and a sort destroys
 * the first-seen order, so a join built on either silently discards the exact property the
 * emitter contract turns on — and reports a tidy, plausible list while doing it. A repeated write
 * to the same path is likewise a FINDING, not noise to be folded away.
 */
type Ledger = Map<string, string[]>

const store = new AsyncLocalStorage<{ emitter: string }>()
const ledger: Ledger = new Map()
/** How much of each emitter's set is already on disk, so an append writes only the delta. */
const appended: Map<string, number> = new Map()

/** Set once at module load: an ordinary build must not pay for a feature it is not using. */
const OUT_DIR = process.env.BJJ_EMIT_LEDGER_DIR
export const enabled = Boolean(OUT_DIR)

/**
 * This thread's part. pid AND threadId: threads share a pid, and a pid alone collides across every
 * worker in the build. threadId is 0 on the main thread and unique per worker within the process.
 */
export const PART_NAME = `ledger-p${process.pid}-t${threadId}.ndjson`

let partStarted = false

/** Append this emitter's not-yet-written paths. Cheap, ordered, and safe to call often. */
function appendDelta(emitter: string) {
  if (!OUT_DIR) return
  const all = ledger.get(emitter)
  if (!all) return
  const from = appended.get(emitter) ?? 0
  if (all.length <= from && partStarted) return
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const fp = path.join(OUT_DIR, PART_NAME)
  // The header line makes an EMPTY part distinguishable from a MISSING one — the whole point of
  // the exercise is that absence must never be able to read as zero.
  if (!partStarted) {
    fs.appendFileSync(fp, JSON.stringify({ part: PART_NAME, pid: process.pid, threadId }) + "\n")
    partStarted = true
  }
  const delta = all.slice(from)
  if (delta.length) {
    fs.appendFileSync(fp, JSON.stringify({ emitter, paths: delta }) + "\n")
    appended.set(emitter, all.length)
  }
}

/** Record what an emitter RETURNED, kept separate from what it WROTE. */
/**
 * What an emitter RETURNED, with the shard it ran as and a per-thread sequence number.
 *
 * Both identifiers are load-bearing for the join. Returns must be concatenated by explicit SHARD
 * INDEX, and thread-id file order is NOT shard-index order — a worker with a lower threadId may
 * have run a higher shard. `seq` orders the calls within one thread. Paths are written exactly as
 * returned: same order, duplicates intact.
 */
function appendReturn(emitter: string, shard: number | null, seq: number, paths: string[]) {
  if (!OUT_DIR) return
  fs.appendFileSync(
    path.join(OUT_DIR, PART_NAME),
    JSON.stringify({ returns: emitter, shard, seq, paths: paths.map(String) }) + "\n",
  )
}

/**
 * A COMPLETED-EXECUTION RECEIPT, written only after the emitter's promise resolves.
 *
 * `emitter_runs: 1` was previously a literal assigned to every configured name, so it said the
 * same thing for an emitter that ran and produced nothing as for one that never ran at all —
 * which is the distinction the whole seam exists to make. A receipt is observed: no receipt means
 * no completed run, and an empty result with a receipt is a legitimate zero.
 */
function appendReceipt(emitter: string, shard: number | null, seq: number, wrote: number, returned: number) {
  if (!OUT_DIR) return
  fs.appendFileSync(
    path.join(OUT_DIR, PART_NAME),
    JSON.stringify({ receipt: emitter, shard, seq, wrote, returned, threadId }) + "\n",
  )
}

/** Write this thread's part even if it claimed nothing, so the join can count parts exactly. */
export function openPart() {
  if (!OUT_DIR || partStarted) return
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.appendFileSync(
    path.join(OUT_DIR, PART_NAME),
    JSON.stringify({ part: PART_NAME, pid: process.pid, threadId }) + "\n",
  )
  partStarted = true
}

function claim(emitter: string, rel: string) {
  let arr = ledger.get(emitter)
  if (!arr) ledger.set(emitter, (arr = []))
  arr.push(rel)
}

/**
 * Run an emitter's body inside its own attribution context. Every `record*` call made underneath
 * it — however deeply, however interleaved with other emitters — is attributed to `emitter`.
 */
let seqCounter = 0

export function track<T>(
  emitter: string,
  fn: () => Promise<T>,
  opts: { shard?: number } = {},
): Promise<T> {
  if (!enabled) return fn()
  openPart()
  const seq = seqCounter++
  const shard = opts.shard ?? null
  const before = (ledger.get(emitter) ?? []).length
  // The delta is appended when the body RESOLVES, which precedes the worker's postMessage and so
  // precedes any terminate(). Deliberately not in a `finally` on the sync path: a rejecting
  // emitter fails the build, and a partial ledger from a failed build must not look complete.
  return store.run({ emitter }, fn).then((value) => {
    appendDelta(emitter)
    const wrote = (ledger.get(emitter) ?? []).length - before
    // THE EMITTER'S OWN RETURN, recorded rather than fabricated. V found every joined record
    // carrying `returned_paths: []`, which is not "this emitter returned nothing" — it was a
    // hard-coded literal, so the field said the same thing for Static (returns 9 while copying
    // 4,952) as for an emitter that genuinely returned none. The gap between what an emitter
    // RETURNS and what it WRITES is the whole reason this seam exists; a constant cannot show it.
    const returned = Array.isArray(value) ? (value as unknown as string[]) : []
    if (Array.isArray(value)) appendReturn(emitter, shard, seq, returned)
    appendReceipt(emitter, shard, seq, wrote, returned.length)
    return value
  })
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
  for (const [emitter, arr] of ledger) out[emitter] = [...arr]
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
