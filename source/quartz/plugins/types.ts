import { PluggableList } from "unified"
import { StaticResources } from "../util/resources"
import { ProcessedContent } from "./vfile"
import { QuartzComponent } from "../components/types"
import { FilePath } from "../util/path"
import { BuildCtx } from "../util/ctx"
import DepGraph from "../depgraph"
import type { Element, Root } from "hast"
import type { FullSlug, SimpleSlug } from "../util/path"

/**
 * S1-1 interface freeze candidate: /home/user/bjj-orchestrator/quartz/INTERFACE.md.
 * Keep the page-data declarations available when transformer implementations move.
 * VFile's Data is Partial<DataMap>: these fields are NOT required on synthetic pages.
 * Existing transformer augmentations are compatible and may remain during migration.
 */
export interface QuartzDataMap {
  slug: FullSlug
  filePath: FilePath
  relativePath: FilePath
  frontmatter: { [key: string]: unknown } & {
    title: string
  } & Partial<{
      tags: string[]
      aliases: string[]
      description: string
      publish: boolean
      draft: boolean
      lang: string
      // Incumbent declaration; the consumer actually tests truthiness. Do not coerce.
      enableToc: string
      cssclasses: string[]
      noindex: boolean
    }>
  dates: { created: Date; modified: Date; published: Date }
  description: string
  text: string
  // Incumbent declaration; JSON.parse currently performs no object-shape validation.
  schemas: object[]
  blocks: Record<string, Element>
  htmlAst: Root
  links: SimpleSlug[]
  toc: { depth: number; text: string; slug: string }[]
  collapseToc: boolean
}

declare module "vfile" {
  interface DataMap extends QuartzDataMap {}
}

/** The existing emitters/helpers.ts write() ABI; strings are written as UTF-8. */
export type QuartzWriteOptions = {
  ctx: BuildCtx
  slug: FullSlug
  ext: `.${string}` | ""
  content: string | Buffer
}

/** Resolves to the output-prefixed filesystem path only after the write completes. */
export type QuartzWrite = (options: QuartzWriteOptions) => Promise<FilePath>

export interface PluginTypes {
  transformers: QuartzTransformerPluginInstance[]
  filters: QuartzFilterPluginInstance[]
  emitters: QuartzEmitterPluginInstance[]
}

type OptionType = object | undefined
export type QuartzTransformerPlugin<Options extends OptionType = undefined> = (
  opts?: Options,
) => QuartzTransformerPluginInstance
export type QuartzTransformerPluginInstance = {
  name: string
  textTransform?: (ctx: BuildCtx, src: string | Buffer) => string | Buffer
  markdownPlugins?: (ctx: BuildCtx) => PluggableList
  htmlPlugins?: (ctx: BuildCtx) => PluggableList
  externalResources?: (ctx: BuildCtx) => Partial<StaticResources>
}

export type QuartzFilterPlugin<Options extends OptionType = undefined> = (
  opts?: Options,
) => QuartzFilterPluginInstance
export type QuartzFilterPluginInstance = {
  name: string
  shouldPublish(ctx: BuildCtx, content: ProcessedContent): boolean
}

export type QuartzEmitterPlugin<Options extends OptionType = undefined> = (
  opts?: Options,
) => QuartzEmitterPluginInstance
export type QuartzEmitterPluginInstance = {
  name: string
  /** Completed writes/copies, not deferred artifacts. The driver awaits this promise. */
  emit(ctx: BuildCtx, content: ProcessedContent[], resources: StaticResources): Promise<FilePath[]>
  getQuartzComponents(ctx: BuildCtx): QuartzComponent[]
  /** Incumbent compatibility only; the replacement full-build driver will not call it. */
  getDependencyGraph?(
    ctx: BuildCtx,
    content: ProcessedContent[],
    resources: StaticResources,
  ): Promise<DepGraph<FilePath>>
}
