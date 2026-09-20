import { QuartzConfig } from "../cfg"
import { FullSlug } from "./path"

export interface Argv {
  /** Content filesystem root, relative to the engine cwd (source/) or absolute. */
  directory: string
  verbose: boolean
  /** Output filesystem root, relative to the same cwd or absolute. */
  output: string
  serve: boolean
  fastRebuild: boolean
  port: number
  wsPort: number
  remoteDevHost?: string
  concurrency?: number
  /** Existing CLI option: local-server URL prefix, NOT a filesystem directory. */
  baseDir?: string
  /** Existing CLI option: print bundler diagnostics. */
  bundleInfo?: boolean
}

/**
 * S1-1 freezes the incumbent context shape. allFiles belongs to component props:
 * emitters derive it from their filtered ProcessedContent[] input. There is no
 * ctx.allFiles or ctx.baseDir; directory bases are specified by Argv above.
 */
export interface BuildCtx {
  buildId: string
  argv: Argv
  cfg: QuartzConfig
  /** Pre-filter discovery order, including non-Markdown inputs; do not re-sort. */
  allSlugs: FullSlug[]
}
