import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
// @ts-ignore
import script from "./scripts/moveCards.inline"

const MoveCards: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  // Only render on position pages with top/bottom roles
  const slug = fileData.slug ?? ""
  const isPositionPage =
    slug.startsWith("Positions/") &&
    (slug.endsWith("/Top") ||
      slug.endsWith("/Bottom") ||
      slug.includes("/Top/") ||
      slug.includes("/Bottom/"))

  if (!isPositionPage) {
    return null
  }

  return (
    <div class={classNames(displayClass, "move-cards-container")}>
      <h3 class="move-cards-title">Your Moves</h3>
      <div class="move-cards" id="move-cards">
        {/* Cards populated by JavaScript from inline state-data */}
      </div>
    </div>
  )
}

MoveCards.css = `
/* Styles defined in custom.scss */
`

MoveCards.afterDOMLoaded = script
export default (() => MoveCards) satisfies QuartzComponentConstructor
