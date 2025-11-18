import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  //afterBody: [Component.DevelopmentBanner()],
  afterBody: [],
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
    Component.ContentMeta(),
    Component.Graph({
      localGraph: { showTags: false, depth: 1 },
      globalGraph: { showTags: false }
    }),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Search(),
    Component.Darkmode(),
    Component.DesktopOnly(Component.Explorer({
      mapFn: (node) => {
        // Strip everything after the first " | " for cleaner Explorer display
        if (node.displayName && node.displayName.includes(" | ")) {
          node.displayName = node.displayName.split(" | ")[0]
        }
      }
    })),
  ],
  right: [
    Component.DesktopOnly(Component.TableOfContents()),
    Component.MobileOnly(Component.Explorer({
      mapFn: (node) => {
        // Strip everything after the first " | " for cleaner Explorer display
        if (node.displayName && node.displayName.includes(" | ")) {
          node.displayName = node.displayName.split(" | ")[0]
        }
      }
    })),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs(),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.Graph({
      localGraph: { showTags: false, depth: 1 },
      globalGraph: { showTags: false }
    }),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Search(),
    Component.Darkmode(),
    Component.DesktopOnly(Component.Explorer({
      mapFn: (node) => {
        // Strip everything after the first " | " for cleaner Explorer display
        if (node.displayName && node.displayName.includes(" | ")) {
          node.displayName = node.displayName.split(" | ")[0]
        }
      }
    })),
  ],
  right: [
    Component.DesktopOnly(Component.TableOfContents()),
    Component.MobileOnly(Component.Explorer({
      mapFn: (node) => {
        // Strip everything after the first " | " for cleaner Explorer display
        if (node.displayName && node.displayName.includes(" | ")) {
          node.displayName = node.displayName.split(" | ")[0]
        }
      }
    })),
  ],
}
