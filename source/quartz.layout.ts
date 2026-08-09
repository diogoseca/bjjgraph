import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

const showBreadcrumbs = process.env.SHOW_BREADCRUMBS === "true"
const breadcrumbs = showBreadcrumbs ? [Component.Breadcrumbs()] : []

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  // Only components the DEFAULT (Neural) front-end needs. The legacy Quartz page UI was
  // deleted in v1.80.0 — see the excision note in components/index.ts. Registration is what
  // costs bytes: componentResources only bundles components an emitter returns from
  // getQuartzComponents(), i.e. only the ones listed here.
  afterBody: [
    Component.AuthUI(), // load-bearing: its script installs the window.__bjjAuth seam
    Component.Search(),
    Component.NeuralMount(), // boots the Neural app bundle
    Component.SnapshotButton(), // localhost-only dev camera
  ],
  // Footer with no links - may add social links later
  footer: Component.Footer({
    links: {},
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    ...breadcrumbs,
    Component.ArticleTitle(),
    Component.ContentMeta({ showReadingTime: false }),
  ],
  left: [Component.DesktopOnly(Component.CategoryNav())],
  right: [Component.DesktopOnly(Component.TableOfContents())],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [...breadcrumbs, Component.ArticleTitle()],
  left: [Component.DesktopOnly(Component.CategoryNav())],
  right: [Component.DesktopOnly(Component.TableOfContents())],
}
