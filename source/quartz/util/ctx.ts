import { QuartzConfig } from "../cfg"
import { FullSlug } from "./path"

export interface Argv {
  directory: string
  verbose: boolean
  output: string
  serve: boolean
  fastRebuild: boolean
  port: number
  wsPort: number
  remoteDevHost?: string
  concurrency?: number
}

export interface BuildCtx {
  buildId: string
  argv: Argv
  cfg: QuartzConfig
  allSlugs: FullSlug[]
  // Git-relative forward-slash Markdown paths; ISO UTC dates. Missing entries are unknown.
  gitPublicationDates?: Record<string, string>
  gitModifiedDates?: Record<string, string>
  // True when gitModifiedDates[path] came from a combined merge diff. Same path keys.
  // Missing field = flags not supplied; within a supplied map, unlisted entries are unflagged.
  gitModifiedDatesFromMerge?: Record<string, true>
}
