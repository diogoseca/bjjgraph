import { QuartzEmitterPlugin } from "../types"
import { track } from "./emitLedger"
import { QuartzComponentProps } from "../../components/types"
import BodyConstructor from "../../components/Body"
import { pageResources, renderPage } from "../../components/renderPage"
import { FullPageLayout } from "../../cfg"
import { FilePath, FullSlug } from "../../util/path"
import { sharedPageComponents, defaultContentPageLayout } from "../../../quartz.layout"
import { NotFound } from "../../components"
import { defaultProcessedContent } from "../vfile"
import { write } from "./helpers"
import { i18n } from "../../i18n"

export const NotFoundPage: QuartzEmitterPlugin = () => {
  const opts: FullPageLayout = {
    ...sharedPageComponents,
    pageBody: NotFound(),
    beforeBody: [],
    // Enable sidebar navigation (Search + Explorer) on 404 page
    left: defaultContentPageLayout.left,
    right: [],
  }

  const { head: Head, pageBody, footer: Footer } = opts
  const Body = BodyConstructor()

  return {
    name: "404Page",
    getQuartzComponents() {
      return [Head, Body, pageBody, Footer]
    },
    async emit(ctx, content, resources): Promise<FilePath[]> {
      return track("404Page", async () => {
        const cfg = ctx.cfg.configuration
        const slug = "404" as FullSlug

        const url = new URL(`https://${cfg.baseUrl ?? "example.com"}`)
        const path = url.pathname as FullSlug
        const externalResources = pageResources(path, resources)
        const notFound = i18n(cfg.locale).pages.error.title
        const [tree, vfile] = defaultProcessedContent({
          slug,
          text: notFound,
          description: notFound,
          frontmatter: { title: notFound, tags: [] },
        })

        // Pass allFiles so Explorer component works properly
        const allFiles = content.map(([_tree, vfile]) => vfile.data)

        const componentData: QuartzComponentProps = {
          ctx,
          fileData: vfile.data,
          externalResources,
          cfg,
          children: [],
          tree,
          allFiles,
        }

        return [
          await write({
            ctx,
            content: renderPage(cfg, slug, componentData, opts, externalResources),
            slug,
            ext: ".html",
          }),
        ]
      })
    },
  }
}
