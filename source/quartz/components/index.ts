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
import Darkmode from "./Darkmode"
import Head from "./Head"
import PageTitle from "./PageTitle"
import ContentMeta from "./ContentMeta"
import Spacer from "./Spacer"
import TableOfContents from "./TableOfContents"
import Explorer from "./Explorer"
import TagList from "./TagList"
import Backlinks from "./Backlinks"
import Search from "./Search"
import Footer from "./Footer"
import DesktopOnly from "./DesktopOnly"
import MobileOnly from "./MobileOnly"
import NotDesktop from "./NotDesktop"
import RecentNotes from "./RecentNotes"
import Breadcrumbs from "./Breadcrumbs"
import Comments from "./Comments"
import CategoryNav from "./CategoryNav"
import AuthUI from "./AuthUI"
import NeuralMount from "./NeuralMount"
import SnapshotButton from "./SnapshotButton"

export {
  ArticleTitle,
  Content,
  TagContent,
  FolderContent,
  Darkmode,
  Head,
  PageTitle,
  ContentMeta,
  Spacer,
  TableOfContents,
  Explorer,
  TagList,
  Backlinks,
  Search,
  Footer,
  DesktopOnly,
  MobileOnly,
  NotDesktop,
  RecentNotes,
  NotFound,
  Breadcrumbs,
  Comments,
  CategoryNav,
  AuthUI,
  NeuralMount,
  SnapshotButton,
}
