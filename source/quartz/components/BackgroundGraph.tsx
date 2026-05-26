import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import script from "./scripts/backgroundGraph.inline"

export default (() => {
  const BackgroundGraph: QuartzComponent = (_props: QuartzComponentProps) => {
    return null
  }

  BackgroundGraph.afterDOMLoaded = script
  return BackgroundGraph
}) satisfies QuartzComponentConstructor
