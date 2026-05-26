import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import script from "./scripts/flashcardsHeader.inline"

// The HTML is rendered directly in renderPage.tsx (as a sibling of #quartz-root)
// so it doesn't inherit the .page transform when entering graph mode. This
// component exists solely to register the inline script.
const FlashcardsHeader: QuartzComponent = () => null

FlashcardsHeader.afterDOMLoaded = script
export default (() => FlashcardsHeader) satisfies QuartzComponentConstructor
