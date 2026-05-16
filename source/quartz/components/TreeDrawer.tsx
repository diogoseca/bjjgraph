import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import script from "./scripts/treeDrawer.inline"

export default (() => {
  const TreeDrawer: QuartzComponent = (_props: QuartzComponentProps) => {
    return null
  }

  TreeDrawer.afterDOMLoaded = script
  return TreeDrawer
}) satisfies QuartzComponentConstructor
