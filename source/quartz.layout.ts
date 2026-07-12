import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
import { stripTitleSuffix } from "./quartz/util/lang"

const showBreadcrumbs = process.env.SHOW_BREADCRUMBS === "true"
const breadcrumbs = showBreadcrumbs ? [Component.Breadcrumbs()] : []

const CATEGORY_ORDER = [
  "Learning",
  "Principles",
  "Positions",
  "Transitions",
  "Submissions",
  "Systems",
]

const explorerSortFn = (a: any, b: any) => {
  const bothFolders = !a.file && !b.file
  const bothFiles = a.file && b.file
  if (bothFolders || bothFiles) {
    if (bothFolders) {
      const aIdx = CATEGORY_ORDER.indexOf(a.name)
      const bIdx = CATEGORY_ORDER.indexOf(b.name)
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
      if (aIdx !== -1) return -1
      if (bIdx !== -1) return 1
    }
    return a.displayName.localeCompare(b.displayName, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  }
  return a.file && !b.file ? 1 : -1
}

const explorerMapFn = (node: any) => {
  if (node.displayName) {
    node.displayName = stripTitleSuffix(node.displayName)
  }
}

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
  left: [
    Component.DesktopOnly(
      Component.Explorer({
        mapFn: explorerMapFn,
        sortFn: explorerSortFn,
      }),
    ),
  ],
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
  left: [
    Component.DesktopOnly(
      Component.Explorer({
        mapFn: explorerMapFn,
        sortFn: explorerSortFn,
      }),
    ),
  ],
  right: [Component.DesktopOnly(Component.TableOfContents())],
}
