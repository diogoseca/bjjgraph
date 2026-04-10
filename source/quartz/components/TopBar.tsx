import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import script from "./scripts/topBar.inline"

const TopBar: QuartzComponent = () => {
  return null
}

TopBar.css = `
/* Styles defined in custom.scss */
`

TopBar.afterDOMLoaded = script
export default (() => TopBar) satisfies QuartzComponentConstructor
