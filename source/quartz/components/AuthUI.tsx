import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import script from "./scripts/authUI.inline"

// Renders nothing and must stay registered anyway: its afterDOMLoaded script is what makes
// window.__bjjAuth exist and what completes the Google OAuth redirect-back on every page.
// See scripts/authUI.inline.ts for why removing it breaks signed-in users invisibly.
const AuthUI: QuartzComponent = () => {
  return null
}

AuthUI.afterDOMLoaded = script
export default (() => AuthUI) satisfies QuartzComponentConstructor
