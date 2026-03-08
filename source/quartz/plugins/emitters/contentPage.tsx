import path from "path"
import { visit } from "unist-util-visit"
import { Root } from "hast"
import { VFile } from "vfile"
import { QuartzEmitterPlugin } from "../types"
import { QuartzComponentProps } from "../../components/types"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import { pageResources, renderPage } from "../../components/renderPage"
import { FullPageLayout } from "../../cfg"
import { Argv } from "../../util/ctx"
import { FilePath, FullSlug, isRelativeURL, joinSegments, pathToRoot } from "../../util/path"
import { defaultContentPageLayout, sharedPageComponents } from "../../../quartz.layout"
import { Content } from "../../components"
import chalk from "chalk"
import { write } from "./helpers"
import DepGraph from "../../depgraph"

// get all the dependencies for the markdown file
// eg. images, scripts, stylesheets, transclusions
const parseDependencies = (argv: Argv, hast: Root, file: VFile): string[] => {
  const dependencies: string[] = []

  visit(hast, "element", (elem): void => {
    let ref: string | null = null

    if (
      ["script", "img", "audio", "video", "source", "iframe"].includes(elem.tagName) &&
      elem?.properties?.src
    ) {
      ref = elem.properties.src.toString()
    } else if (["a", "link"].includes(elem.tagName) && elem?.properties?.href) {
      // transclusions will create a tags with relative hrefs
      ref = elem.properties.href.toString()
    }

    // if it is a relative url, its a local file and we need to add
    // it to the dependency graph. otherwise, ignore
    if (ref === null || !isRelativeURL(ref)) {
      return
    }

    let fp = path.join(file.data.filePath!, path.relative(argv.directory, ref)).replace(/\\/g, "/")
    // markdown files have the .md extension stripped in hrefs, add it back here
    if (!fp.split("/").pop()?.includes(".")) {
      fp += ".md"
    }
    dependencies.push(fp)
  })

  return dependencies
}

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
    async getDependencyGraph(ctx, content, _resources) {
      const graph = new DepGraph<FilePath>()

      for (const [tree, file] of content) {
        const sourcePath = file.data.filePath!
        const slug = file.data.slug!
        graph.addEdge(sourcePath, joinSegments(ctx.argv.output, slug + ".html") as FilePath)

        parseDependencies(ctx.argv, tree as Root, file).forEach((dep) => {
          graph.addEdge(dep as FilePath, sourcePath)
        })
      }

      return graph
    },
    async emit(ctx, content, resources): Promise<FilePath[]> {
      const cfg = ctx.cfg.configuration
      const allFiles = content.map((c) => c[1].data)

      // Build slugMap once for O(1) transclusion lookups (replaces O(n) .find() per page)
      const slugMap = new Map<FullSlug, typeof allFiles[0]>()
      for (const f of allFiles) {
        if (f.slug) slugMap.set(f.slug, f)
      }

      // Render all pages (CPU-bound), then batch write to disk
      const WRITE_BATCH = 64
      const fps: FilePath[] = []
      const pendingWrites: Array<{ ctx: typeof ctx; content: string; slug: FullSlug; ext: ".html" }> =
        []

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
