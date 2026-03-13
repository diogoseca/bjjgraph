import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
// @ts-ignore
import script from "./scripts/trainingDashboard.inline"

const TrainingDashboard: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const slug = fileData.slug ?? ""
  if (slug.toLowerCase() !== "training") return null

  return (
    <div id="training-dashboard" class={classNames(displayClass, "training-dashboard")}>
      {/* Daily Goals */}
      <div class="training-goals" id="training-goals">
        <div class="training-goal">
          <div class="training-goal-header">
            <span class="training-goal-label">New Techniques</span>
            <span class="training-goal-progress" id="training-learn-progress">
              0/3
            </span>
          </div>
          <div class="training-goal-bar">
            <div class="training-goal-fill" id="training-learn-fill"></div>
          </div>
        </div>
        <div class="training-goal">
          <div class="training-goal-header">
            <span class="training-goal-label">Reviews</span>
            <span class="training-goal-progress" id="training-review-progress">
              0/10
            </span>
          </div>
          <div class="training-goal-bar">
            <div class="training-goal-fill" id="training-review-fill"></div>
          </div>
        </div>
      </div>

      <div class="training-summary">
        <div class="training-stat">
          <span class="training-stat-value" id="training-due-count">
            0
          </span>
          <span class="training-stat-label">Due Today</span>
        </div>
        <div class="training-stat">
          <span class="training-stat-value" id="training-upcoming-count">
            0
          </span>
          <span class="training-stat-label">Upcoming</span>
        </div>
        <div class="training-stat">
          <span class="training-stat-value" id="training-mastered-count">
            0
          </span>
          <span class="training-stat-label">Mastered</span>
        </div>
      </div>

      {/* Coverage */}
      <div class="training-section" id="training-coverage-section">
        <h3>Coverage</h3>
        <div class="training-coverage" id="training-coverage"></div>
      </div>

      <div class="training-section" id="training-due-section">
        <h3>Due for Review</h3>
        <div class="training-cards-list" id="training-due-list"></div>
      </div>

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

      {/* Timeline / Memorized Moves */}
      <div class="training-section" id="training-timeline-section">
        <h3>Your Journey</h3>
        <div class="training-timeline" id="training-timeline"></div>
      </div>

      <div class="training-section" id="training-upcoming-section">
        <h3>Upcoming</h3>
        <div class="training-cards-list" id="training-upcoming-list"></div>
      </div>

      <div class="training-section" id="training-mastered-section">
        <h3>Mastered</h3>
        <div class="training-cards-list" id="training-mastered-list"></div>
      </div>

      <div class="training-section">
        <h3>Add Technique</h3>
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
          <div class="training-setting-row">
            <label for="setting-opponent-on-fail">Opponent attacks when move fails</label>
            <input type="checkbox" id="setting-opponent-on-fail" />
          </div>
          <div class="training-setting-row">
            <label for="setting-daily-learn">Daily new technique goal</label>
            <input type="number" id="setting-daily-learn" min="1" max="20" />
          </div>
          <div class="training-setting-row">
            <label for="setting-daily-review">Daily review goal</label>
            <input type="number" id="setting-daily-review" min="1" max="50" />
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
