import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
import { stripTitleSuffix } from "./quartz/util/lang"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [
    Component.ContentMeta({ showReadingTime: false }),
    Component.EditOnGithub(),
    Component.Snackbar(),
  ],
  // Footer with no links - may add social links later
  footer: Component.Footer({
    links: {},
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs(),
    Component.ArticleTitle(),
    Component.VictoryDisplay(),
    Component.MoveCards(),
    Component.TransitionFlashcard(),
    Component.Graph({
      localGraph: { showTags: false, depth: 1 },
      globalGraph: { showTags: false }
    }),
  ],
  left: [
    Component.Search(),
    Component.DesktopOnly(Component.Explorer({
      mapFn: (node) => {
        if (node.displayName) {
          node.displayName = stripTitleSuffix(node.displayName)
        }
      }
    })),
  ],
  right: [
    Component.DesktopOnly(Component.TableOfContents()),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs(),
    Component.ArticleTitle(),
    Component.Graph({
      localGraph: { showTags: false, depth: 1 },
      globalGraph: { showTags: false }
    }),
  ],
  left: [
    Component.Search(),
    Component.DesktopOnly(Component.Explorer({
      mapFn: (node) => {
        if (node.displayName) {
          node.displayName = stripTitleSuffix(node.displayName)
        }
      }
    })),
  ],
  right: [
    Component.DesktopOnly(Component.TableOfContents()),
  ],
}
