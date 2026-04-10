import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
// @ts-ignore
import script from "./scripts/trainingDashboard.inline"

const TrainingDashboard: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const slug = fileData.slug ?? ""
  if (slug.toLowerCase() !== "training") return null

  return (
    <div id="training-dashboard" class={classNames(displayClass, "training-dashboard")}>
      {/* Completion Banner */}
      <div
        class="training-completion-banner"
        id="training-completion-banner"
        style={{ display: "none" }}
      ></div>

      {/* Flashcard Area (hidden until training) */}
      <div class="training-flashcard-area" id="training-flashcard-area" style={{ display: "none" }}>
        <div class="flashcard" id="training-flashcard">
          <div class="flashcard-label" id="training-flashcard-label">
            Technique Test
          </div>
          <div class="flashcard-question" id="training-flashcard-question"></div>
          <div class="flashcard-answer hidden" id="training-flashcard-answer"></div>
          <div class="flashcard-actions">
            <button class="reveal-btn" id="training-reveal-btn">
              Reveal Answer
            </button>
            <div class="result-btns hidden" id="training-result-btns">
              <button class="again-btn" id="training-again-btn">
                Again
              </button>
              <button class="hard-btn" id="training-hard-btn">
                Hard
              </button>
              <button class="easy-btn" id="training-easy-btn">
                Easy
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Prompt (shown for unauthenticated users) */}
      <div id="training-auth-prompt"></div>

      {/* Today's Session */}
      <div class="training-section" id="training-session-section">
        <h3 id="training-session-header">Today's Session</h3>
        <div class="training-goals" id="training-goals">
          <div class="training-goal">
            <div class="training-goal-header">
              <span class="training-goal-progress" id="training-daily-progress">
                0/30
              </span>
              <span
                class="training-streak-display"
                id="training-streak-display"
                title="Consecutive days with at least one review"
              ></span>
            </div>
            <div class="training-goal-bar">
              <div class="training-goal-fill" id="training-daily-fill"></div>
            </div>
          </div>
        </div>
        <div class="training-session-btn-area" id="training-session-btn-area"></div>
      </div>

      {/* Known Techniques */}
      <div class="training-section" id="training-known-section">
        <h3
          id="training-known-header"
          title="Techniques you're actively studying with spaced repetition"
        >
          Known Techniques
        </h3>
        <div id="training-known-list"></div>
      </div>

      {/* Discover */}
      <div class="training-section" id="training-discover-section">
        <h3
          id="training-discover-header"
          title="Techniques suggested based on your current knowledge graph"
        >
          Discover
        </h3>
        <div id="training-suggestions"></div>
        <input
          type="text"
          class="training-search-input"
          id="training-search-input"
          placeholder="Search techniques to add..."
        />
        <div class="technique-search-results" id="technique-search-results"></div>
      </div>

      {/* Settings */}
      <div class="training-section training-settings-section" id="training-settings-section">
        <h3>
          <button class="training-settings-toggle" id="training-settings-toggle">
            Settings
            <span class="training-settings-arrow" id="training-settings-arrow">
              &#9654;
            </span>
          </button>
        </h3>
        <div class="training-settings" id="training-settings" style={{ display: "none" }}>
          <div class="training-setting-row training-setting-row--game-mode">
            <label title="Controls dice rolls and difficulty when browsing technique pages">
              Game Mode
            </label>
            <div class="game-mode-selector" id="game-mode-selector">
              <button class="game-mode-btn" data-mode="off" title="No dice rolls, pure browsing">
                Off
              </button>
              <button
                class="game-mode-btn"
                data-mode="normal"
                title="Dice rolls with mastery bonus"
              >
                Normal
              </button>
              <button
                class="game-mode-btn game-mode-btn--locked"
                data-mode="hard"
                title="Coming soon"
                disabled
              >
                Hard &#x1F512;
              </button>
              <button
                class="game-mode-btn game-mode-btn--locked"
                data-mode="ultra"
                title="Coming soon"
                disabled
              >
                Ultra &#x1F512;
              </button>
            </div>
          </div>
          <div class="training-setting-row">
            <label
              for="setting-daily-goal"
              title="How many techniques to review and learn each day"
            >
              Daily goal (techniques)
            </label>
            <input type="number" id="setting-daily-goal" min="1" max="100" />
          </div>
          <div class="training-setting-row">
            <label
              for="setting-show-flashcards"
              title="Show a knowledge quiz on technique pages to test your understanding"
            >
              Show Flashcards on pages
            </label>
            <input type="checkbox" id="setting-show-flashcards" />
          </div>
        </div>
      </div>
    </div>
  )
}

TrainingDashboard.css = `
/* Styles defined in custom.scss */
`

TrainingDashboard.afterDOMLoaded = script
export default (() => TrainingDashboard) satisfies QuartzComponentConstructor
