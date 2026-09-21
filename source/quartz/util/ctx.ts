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
}
