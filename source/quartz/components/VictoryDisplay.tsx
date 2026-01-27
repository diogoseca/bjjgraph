import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
// @ts-ignore
import script from "./scripts/victoryDisplay.inline"

const VictoryDisplay: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const slug = fileData.slug ?? ""

  // Only render on game-over page
  // Slug format: "game-over" (lowercase)
  const isVictoryPage = slug.toLowerCase() === "game-over"

  if (!isVictoryPage) {
    return null
  }

  return (
    <div
      id="victory-display"
      class={classNames(displayClass, "victory-display")}
      data-page-type="victory"
    >
      {/* Victory content - shown when journey data exists */}
      <div id="victory-content" class="terminal-state victory" style="display: none;">
        <div id="confetti-container"></div>
        <h2 id="victory-title">Victory!</h2>
        <p id="victory-subtitle" class="victory-subtitle"></p>

        {/* Stats Row */}
        <div id="victory-stats" class="victory-stats">
          <div class="stat-item">
            <span class="stat-value" id="stat-moves">0</span>
            <span class="stat-label">Moves</span>
          </div>
          <div class="stat-item">
            <span class="stat-value" id="stat-successes">0</span>
            <span class="stat-label">Successes</span>
          </div>
          <div class="stat-item">
            <span class="stat-value" id="stat-failures">0</span>
            <span class="stat-label">Defended</span>
          </div>
        </div>

        {/* Performance Report */}
        <div id="performance-report" class="performance-report" style="display: none;">
          <div class="report-columns">
            <div class="report-column strengths">
              <h4 class="report-heading">Strengths</h4>
              <ul id="report-strengths" class="report-list"></ul>
            </div>
            <div class="report-column weaknesses">
              <h4 class="report-heading">Revisit</h4>
              <ul id="report-weaknesses" class="report-list"></ul>
            </div>
          </div>
        </div>

        {/* Roll Again Button */}
        <button id="roll-again-btn" class="roll-again-btn">
          <img src="/static/dice-icon.svg" alt="" class="roll-icon" />
          <span>Roll Again</span>
        </button>

        {/* Journey Replay */}
        <div id="journey-replay" class="journey-replay">
          <h4>Your Path to Victory</h4>
          <div id="journey-path" class="journey-path"></div>
        </div>
      </div>

      {/* Fallback for direct navigation (no victory data) */}
      <div id="victory-fallback" class="victory-fallback" style="display: none;">
        <p class="fallback-message">Ready to test your BJJ knowledge?</p>
        <button id="start-roll-btn" class="roll-again-btn">
          <img src="/static/dice-icon.svg" alt="" class="roll-icon" />
          <span>Start Rolling</span>
        </button>
      </div>
    </div>
  )
}

VictoryDisplay.css = `/* Styles defined in custom.scss */`
VictoryDisplay.afterDOMLoaded = script
export default (() => VictoryDisplay) satisfies QuartzComponentConstructor
