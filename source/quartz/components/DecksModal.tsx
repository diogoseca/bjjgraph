import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import script from "./scripts/decksModal.inline"

// DecksModal — overlay opened by clicking the FlashcardsHeader label.
// The component itself renders nothing; the modal DOM is injected by the
// script on demand and removed on close, mirroring the AuthUI pattern.
const DecksModal: QuartzComponent = () => {
  return null
}

DecksModal.css = `/* Styles defined in custom.scss */`

DecksModal.afterDOMLoaded = script
export default (() => DecksModal) satisfies QuartzComponentConstructor
