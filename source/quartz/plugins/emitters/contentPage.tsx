import { QuartzEmitterPlugin } from "../types"
import { QuartzComponentProps } from "../../components/types"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import { pageResources, renderPage } from "../../components/renderPage"
import { FullPageLayout } from "../../cfg"
import { FilePath, FullSlug, pathToRoot } from "../../util/path"
import { defaultContentPageLayout, sharedPageComponents } from "../../../quartz.layout"
import { Content } from "../../components"
import chalk from "chalk"
import { write } from "./helpers"

export const ContentPage: QuartzEmitterPlugin<Partial<FullPageLayout>> = (userOpts) => {
  const opts: FullPageLayout = {
    ...sharedPageComponents,
    ...defaultContentPageLayout,
    pageBody: Content(),
    ...userOpts,
  }

  const { head: Head, header, beforeBody, pageBody, afterBody, left, right, footer: Footer } = opts
  const Header = HeaderConstructor()
  const Body = BodyConstructor()

  return {
    name: "ContentPage",
    getQuartzComponents() {
      return [
        Head,
        Header,
        Body,
        ...header,
        ...beforeBody,
        pageBody,
        ...afterBody,
        ...left,
        ...right,
        Footer,
      ]
    },
    async emit(ctx, content, resources): Promise<FilePath[]> {
      const cfg = ctx.cfg.configuration
      const allFiles = content.map((c) => c[1].data)

      // Build slugMap once for O(1) transclusion lookups (replaces O(n) .find() per page)
      const slugMap = new Map<FullSlug, (typeof allFiles)[0]>()
      for (const f of allFiles) {
        if (f.slug) slugMap.set(f.slug, f)
      }

      // Render all pages (CPU-bound), then batch write to disk
      const WRITE_BATCH = 64
      const fps: FilePath[] = []
      const pendingWrites: Array<{
        ctx: typeof ctx
        content: string
        slug: FullSlug
        ext: ".html"
      }> = []

      let containsIndex = false
      for (const [tree, file] of content) {
        const slug = file.data.slug!
        if (slug === "index") {
          containsIndex = true
        }

        const externalResources = pageResources(pathToRoot(slug), resources)
        const componentData: QuartzComponentProps = {
          ctx,
          fileData: file.data,
          externalResources,
          cfg,
          children: [],
          tree,
          allFiles,
          slugMap,
        }

        const rendered = renderPage(cfg, slug, componentData, opts, externalResources)
        pendingWrites.push({ ctx, content: rendered, slug, ext: ".html" })

        // Flush writes in batches to avoid holding too much in memory
        if (pendingWrites.length >= WRITE_BATCH) {
          const batch = pendingWrites.splice(0, pendingWrites.length)
          const results = await Promise.all(batch.map((w) => write(w)))
          fps.push(...results)
        }
      }

      // Flush remaining
      if (pendingWrites.length > 0) {
        const results = await Promise.all(pendingWrites.map((w) => write(w)))
        fps.push(...results)
      }

      if (!containsIndex && !ctx.argv.fastRebuild) {
        console.log(
          chalk.yellow(
            `\nWarning: you seem to be missing an \`index.md\` home page file at the root of your \`${ctx.argv.directory}\` folder. This may cause errors when deploying.`,
          ),
        )
      }

      return fps
    },
  }
}
