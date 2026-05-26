import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
// @ts-ignore
import script from "./scripts/moveCards.inline"

const MoveCards: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  // Only render on position pages with top/bottom roles
  const slug = fileData.slug ?? ""
  const slugLower = slug.toLowerCase()
  const isPositionPage =
    slugLower.startsWith("positions/") &&
    (slugLower.endsWith("/top") ||
      slugLower.endsWith("/bottom") ||
      slugLower.includes("/top/") ||
      slugLower.includes("/bottom/"))

  if (!isPositionPage) {
    return null
  }

  return (
    <div class={classNames(displayClass, "move-cards-container")}>
      <h3 class="move-cards-title">
        Your Moves
        <span class="game-mode-picker" id="game-mode-picker">
          <span class="game-mode-label" id="game-mode-label"></span>
          <div class="game-mode-dropdown" id="game-mode-dropdown">
            <div class="game-mode-dropdown-hint">
              Roll dice against an AI opponent when you click a move.
            </div>
            <button
              class="game-mode-option"
              data-mode="off"
              title="Just navigate — no dice, no opponent"
            >
              Off — pure browsing
            </button>
            <button
              class="game-mode-option"
              data-mode="normal"
              title="Each click rolls dice based on the move's win % (boosted by your mastery)"
            >
              Normal — dice rolls
            </button>
            <button
              class="game-mode-option game-mode-option--locked"
              data-mode="hard"
              disabled
              title="Coming soon"
            >
              Hard &#x1F512;
            </button>
            <button
              class="game-mode-option game-mode-option--locked"
              data-mode="ultra"
              disabled
              title="Coming soon"
            >
              Ultra &#x1F512;
            </button>
          </div>
        </span>
      </h3>
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
