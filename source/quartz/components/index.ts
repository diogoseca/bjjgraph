// Quartz component barrel.
//
// v1.80.0 deleted the legacy Quartz page UI (the `?variant=legacy` front-end). Anything it
// owned — the in-page graphs, the SRS/training stack, the move/outcome trays, the legacy
// chrome — is gone; the default Neural app owns the screen. Do NOT re-add a component here
// without also registering it in quartz.layout.ts: registration, not export, is what makes
// componentResources bundle its script into postscript.js.

import Content from "./pages/Content"
import TagContent from "./pages/TagContent"
import FolderContent from "./pages/FolderContent"
import NotFound from "./pages/404"
import ArticleTitle from "./ArticleTitle"
import Head from "./Head"
import ContentMeta from "./ContentMeta"
import TableOfContents from "./TableOfContents"
import Search from "./Search"
import Footer from "./Footer"
import DesktopOnly from "./DesktopOnly"
import Breadcrumbs from "./Breadcrumbs"
import CategoryNav from "./CategoryNav"
import AuthUI from "./AuthUI"
import NeuralMount from "./NeuralMount"
import SnapshotButton from "./SnapshotButton"

export {
  ArticleTitle,
  Content,
  TagContent,
  FolderContent,
  Head,
  ContentMeta,
  TableOfContents,
  Search,
  Footer,
  DesktopOnly,
  NotFound,
  Breadcrumbs,
  CategoryNav,
  AuthUI,
  NeuralMount,
  SnapshotButton,
}
