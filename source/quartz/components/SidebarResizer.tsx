import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import script from "./scripts/sidebarResizer.inline"

const SidebarResizer: QuartzComponent = () => {
  return null
}

SidebarResizer.css = `
/* Styles defined in custom.scss */
`

SidebarResizer.afterDOMLoaded = script
export default (() => SidebarResizer) satisfies QuartzComponentConstructor
