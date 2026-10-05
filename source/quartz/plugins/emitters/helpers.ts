import path from "path"
import fs from "fs"
import { BuildCtx } from "../../util/ctx"
import { GlobalConfiguration } from "../../cfg"
import { FilePath, FullSlug, joinSegments } from "../../util/path"
import { recordWrite } from "./emitLedger"

/** THE SITE ROOT, ROOT-ABSOLUTE ("/" for bjjgraph.org): the base every page's own resources hang off.
 *
 * Not `pathToRoot(slug)`. That is RELATIVE ("../../../"), and a relative URL is re-resolved against
 * whatever the address bar says when it is next used. The Neural app moves the address bar with
 * `history.pushState` (`_pushUrl`), so a page loaded at `/` and then navigated to
 * `/Positions/Side-Control/Bottom` resolved its `../static/icon.png` to `/Positions/static/icon.png`:
 * the owner's 404 on the dev preview (CONSOLE0, 2026-10-05). The icon is the one the browser
 * re-fetches on its own, but `index.css`, `prescript.js`, `postscript.js` and the lazy
 * `contentIndex.json` fetch all came from the same relative base. Gated by
 * `e2e/journeys/console-clean.spec.ts`, which navigates client-side and resolves every resource
 * URL against the new address. */
export function siteRoot(cfg: GlobalConfiguration): FullSlug {
  return new URL(`https://${cfg.baseUrl ?? "example.com"}`).pathname as FullSlug
}

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
