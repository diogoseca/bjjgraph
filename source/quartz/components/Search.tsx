import { QuartzComponent, QuartzComponentConstructor } from "./types"
import style from "./styles/search.scss"
// @ts-ignore
import script from "./scripts/search.inline"

export interface SearchOptions {
  enablePreview: boolean
}

// The HTML (#search-button + #search-container) is rendered directly in
// renderPage.tsx as a sibling of #quartz-root. That keeps the trigger button
// a top-level floating button (matching #tree-toggle, #roll-session-btn, etc.)
// and decouples it from the sidebar drawer. This component exists solely to
// register the inline script and CSS.
export default ((_userOpts?: Partial<SearchOptions>) => {
  const Search: QuartzComponent = () => null
  Search.afterDOMLoaded = script
  Search.css = style
  return Search
}) satisfies QuartzComponentConstructor
