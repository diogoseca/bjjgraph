import path from "path"
import fs from "fs"
import { BuildCtx } from "../../util/ctx"
import { FilePath, FullSlug, joinSegments } from "../../util/path"

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
  return pathToPage
}
