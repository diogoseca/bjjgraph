import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import script from "./scripts/firstLoadHint.inline"

// FirstLoadHint — tiny tooltip-arrow pointing at the strip's ▶ button on
// first visit. Auto-dismisses after 5s, on Esc, or on any click. Sets
// localStorage["bjj-onboarded"] so it never reappears.
const FirstLoadHint: QuartzComponent = () => {
  return null
}

FirstLoadHint.css = `/* Styles defined in custom.scss */`

FirstLoadHint.afterDOMLoaded = script
export default (() => FirstLoadHint) satisfies QuartzComponentConstructor
