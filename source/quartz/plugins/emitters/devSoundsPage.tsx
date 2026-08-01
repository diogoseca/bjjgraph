import { FullPageLayout } from "../../cfg"
import BodyConstructor from "../../components/Body"
import HeaderConstructor from "../../components/Header"
import { SoundLab } from "../../components"
import { pageResources, renderPage } from "../../components/renderPage"
import { QuartzComponentProps } from "../../components/types"
import DepGraph from "../../depgraph"
import { FilePath, FullSlug, pathToRoot } from "../../util/path"
import { defaultContentPageLayout, sharedPageComponents } from "../../../quartz.layout"
import { QuartzEmitterPlugin } from "../types"
import { defaultProcessedContent } from "../vfile"
import { write } from "./helpers"

export const DevSoundsPage: QuartzEmitterPlugin = () => {
  const opts: FullPageLayout = {
    ...sharedPageComponents,
    pageBody: SoundLab(),
    beforeBody: [],
    left: defaultContentPageLayout.left,
    right: [],
  }

  const { head: Head, header, beforeBody, pageBody, afterBody, left, right, footer: Footer } = opts
  const Header = HeaderConstructor()
  const Body = BodyConstructor()

  return {
    name: "DevSoundsPage",
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
    async getDependencyGraph() {
      return new DepGraph<FilePath>()
    },
    async emit(ctx, content, resources): Promise<FilePath[]> {
      const cfg = ctx.cfg.configuration
      const slug = "dev/sounds" as FullSlug
      const externalResources = pageResources(pathToRoot(slug), resources)
      const [tree, vfile] = defaultProcessedContent({
        slug,
        text: "BJJ Graph gameplay sound lab",
        description:
          "Developer sound lab for previewing BJJ Graph neural, electrical, and space gameplay cues in context.",
        frontmatter: {
          title: "Gameplay Sound Lab | BJJ Graph",
          tags: [],
          noindex: true,
        },
      })

      const allFiles = content.map(([, file]) => file.data)
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
    },
  }
}
