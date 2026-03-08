import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import script from "./scripts/snackbar.inline"

const Snackbar: QuartzComponent = (_props: QuartzComponentProps) => {
  return <div id="snackbar-container"></div>
}

Snackbar.css = `
/* Styles defined in custom.scss */
`

Snackbar.afterDOMLoaded = script
export default (() => Snackbar) satisfies QuartzComponentConstructor
