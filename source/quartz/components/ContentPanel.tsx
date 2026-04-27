import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import script from "./scripts/contentPanel.inline"

export default (() => {
  const ContentPanel: QuartzComponent = (_props: QuartzComponentProps) => {
    return null
  }

  ContentPanel.afterDOMLoaded = script
  return ContentPanel
}) satisfies QuartzComponentConstructor
