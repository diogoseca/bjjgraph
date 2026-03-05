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

// Cache of directories already created this build (avoids redundant mkdir syscalls)
const createdDirs = new Set<string>()

export const write = async ({ ctx, slug, ext, content }: WriteOptions): Promise<FilePath> => {
  const pathToPage = joinSegments(ctx.argv.output, slug + ext) as FilePath
  const dir = path.dirname(pathToPage)
  if (!createdDirs.has(dir)) {
    await fs.promises.mkdir(dir, { recursive: true })
    createdDirs.add(dir)
  }
  await fs.promises.writeFile(pathToPage, content)
  return pathToPage
}
