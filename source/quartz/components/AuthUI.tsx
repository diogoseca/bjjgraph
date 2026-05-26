import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import script from "./scripts/authUI.inline"

const AuthUI: QuartzComponent = () => {
  return null
}

AuthUI.css = `
/* Styles defined in custom.scss */
`

AuthUI.afterDOMLoaded = script
export default (() => AuthUI) satisfies QuartzComponentConstructor
