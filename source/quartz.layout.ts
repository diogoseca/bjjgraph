import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

const showBreadcrumbs = process.env.SHOW_BREADCRUMBS === "true"
const breadcrumbs = showBreadcrumbs ? [Component.Breadcrumbs()] : []

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [
    Component.Snackbar(),
    Component.TopBar(),
    Component.AuthUI(),
    Component.ContentPanel(),
    Component.BackgroundGraph(),
    Component.TreeDrawer(),
    Component.FlashcardsHeader(),
    Component.DecksModal(),
    Component.SettingsModal(),
    Component.SessionChevrons(),
    Component.RollSessionButton(),
    Component.Search(),
    Component.AffiliateTracking(),
    Component.NeuralMount(),
    Component.SnapshotButton(),
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
    Component.VictoryDisplay(),
    Component.TreeExplorer(),
    Component.MoveCards(),
    Component.OutcomeCards(),
    Component.SystemProgress(),
    Component.Flashcard(),
    Component.Graph({
      localGraph: { showTags: false, depth: 1 },
      globalGraph: { showTags: false },
    }),
  ],
  left: [Component.DesktopOnly(Component.CategoryNav())],
  right: [Component.DesktopOnly(Component.TableOfContents())],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [
    ...breadcrumbs,
    Component.ArticleTitle(),
    Component.Graph({
      localGraph: { showTags: false, depth: 1 },
      globalGraph: { showTags: false },
    }),
  ],
  left: [Component.DesktopOnly(Component.CategoryNav())],
  right: [Component.DesktopOnly(Component.TableOfContents())],
}
