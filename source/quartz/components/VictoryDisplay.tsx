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

        {/* Current Roll Stats */}
        <div class="stats-section">
          <h4 class="stats-heading">Current Roll</h4>
          <div id="victory-stats" class="victory-stats">
            <div class="stat-item">
              <span class="stat-value" id="stat-moves">
                0
              </span>
              <span class="stat-label">Moves</span>
            </div>
            <div class="stat-item">
              <span class="stat-value stat-success" id="stat-dice-won">
                0
              </span>
              <span class="stat-label">Dice Won</span>
            </div>
            <div class="stat-item">
              <span class="stat-value stat-failure" id="stat-dice-lost">
                0
              </span>
              <span class="stat-label">Dice Lost</span>
            </div>
            <div class="stat-item">
              <span class="stat-value stat-success" id="stat-flash-right">
                0
              </span>
              <span class="stat-label">Flashcards Right</span>
            </div>
            <div class="stat-item">
              <span class="stat-value stat-failure" id="stat-flash-wrong">
                0
              </span>
              <span class="stat-label">Flashcards Wrong</span>
            </div>
          </div>
        </div>

        {/* Technique Performance */}
        <div id="performance-report" class="performance-report" style="display: none;">
          <h4 class="stats-heading">Technique Performance</h4>
          <div class="report-columns">
            <div class="report-column strengths">
              <h4 class="report-heading">Strongest</h4>
              <ul id="report-strengths" class="report-list"></ul>
            </div>
            <div class="report-column weaknesses">
              <h4 class="report-heading">Needs Drilling</h4>
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

        {/* Lifetime Stats */}
        <div id="lifetime-stats" class="lifetime-stats-section" style="display: none;">
          <h4 class="stats-heading">Lifetime Stats</h4>
          <div class="victory-stats">
            <div class="stat-item">
              <span class="stat-value" id="lifetime-rolls">
                0
              </span>
              <span class="stat-label">Total Rolls</span>
            </div>
            <div class="stat-item">
              <span class="stat-value" id="lifetime-victories">
                0
              </span>
              <span class="stat-label">Victories</span>
            </div>
            <div class="stat-item">
              <span class="stat-value" id="lifetime-dice-rate">
                0%
              </span>
              <span class="stat-label">Dice Win Rate</span>
            </div>
            <div class="stat-item">
              <span class="stat-value" id="lifetime-flash-rate">
                0%
              </span>
              <span class="stat-label">Flashcard Rate</span>
            </div>
          </div>
          <div id="lifetime-performance" class="performance-report" style="display: none;">
            <div class="report-columns">
              <div class="report-column strengths">
                <h4 class="report-heading">All-Time Strengths</h4>
                <ul id="lifetime-strengths" class="report-list"></ul>
              </div>
              <div class="report-column weaknesses">
                <h4 class="report-heading">All-Time Weaknesses</h4>
                <ul id="lifetime-weaknesses" class="report-list"></ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fallback for direct navigation (no victory data) */}
      <div id="victory-fallback" class="victory-fallback" style="display: none;">
        <p class="fallback-message">Ready to test your BJJ knowledge?</p>
        <button id="start-roll-btn" class="roll-again-btn">
          <img src="/static/dice-icon.svg" alt="" class="roll-icon" />
          <span>Start Rolling</span>
        </button>

        {/* Lifetime Stats in fallback */}
        <div id="fallback-lifetime-stats" class="lifetime-stats-section" style="display: none;">
          <h4 class="stats-heading">Your Progress</h4>
          <div class="victory-stats">
            <div class="stat-item">
              <span class="stat-value" id="fallback-lifetime-rolls">
                0
              </span>
              <span class="stat-label">Total Rolls</span>
            </div>
            <div class="stat-item">
              <span class="stat-value" id="fallback-lifetime-victories">
                0
              </span>
              <span class="stat-label">Victories</span>
            </div>
            <div class="stat-item">
              <span class="stat-value" id="fallback-lifetime-dice-rate">
                0%
              </span>
              <span class="stat-label">Dice Win Rate</span>
            </div>
            <div class="stat-item">
              <span class="stat-value" id="fallback-lifetime-flash-rate">
                0%
              </span>
              <span class="stat-label">Flashcard Rate</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

VictoryDisplay.css = `/* Styles defined in custom.scss */`
VictoryDisplay.afterDOMLoaded = script
export default (() => VictoryDisplay) satisfies QuartzComponentConstructor
