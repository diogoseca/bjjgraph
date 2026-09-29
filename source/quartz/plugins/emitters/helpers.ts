import path from "path"
import fs from "fs"
import { BuildCtx } from "../../util/ctx"
import { FilePath, FullSlug, joinSegments } from "../../util/path"
import { recordWrite } from "./emitLedger"

type WriteOptions = {
  ctx: BuildCtx
  slug: FullSlug
  ext: `.${string}` | ""
  content: string | Buffer
}

// Build-local: the driver removes output directories before every full/watch rebuild.
// A module-level Set outlives that cleanup and skips required mkdirs on the second build.
// Keys use ctx object identity: {...ctx} gets a fresh cache. This is only an optimization.
const createdDirs = new WeakMap<BuildCtx, Set<string>>()

export const write = async ({ ctx, slug, ext, content }: WriteOptions): Promise<FilePath> => {
  const pathToPage = joinSegments(ctx.argv.output, slug + ext) as FilePath
  const dir = path.dirname(pathToPage)
  let dirs = createdDirs.get(ctx)
  if (!dirs) createdDirs.set(ctx, (dirs = new Set()))
  if (!dirs.has(dir)) {
    await fs.promises.mkdir(dir, { recursive: true })
    dirs.add(dir)
  }
  await fs.promises.writeFile(pathToPage, content)
  // ATTRIBUTION ONLY (D-B-05): records WHICH emitter wrote this path, never whether it exists.
  // Existence, size and sha256 come from the post-build walk; a producer-side record cannot
  // prove coverage. No-ops unless BJJ_EMIT_LEDGER_DIR is set.
  recordWrite(ctx.argv.output, pathToPage)
  return pathToPage
}
