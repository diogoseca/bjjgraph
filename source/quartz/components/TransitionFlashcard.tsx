import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
// @ts-ignore
import script from "./scripts/flashcard.inline"

const TransitionFlashcard: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const slug = fileData.slug ?? ""

  // Only render on transition, submission, and position role pages
  const isTransitionPage = slug.startsWith("Transitions/")
  const isSubmissionPage = slug.startsWith("Submissions/")
  const slugLower = slug.toLowerCase()
  const isPositionRolePage = slugLower.endsWith("/bottom") || slugLower.endsWith("/top")

  if (!isTransitionPage && !isSubmissionPage && !isPositionRolePage) {
    return null
  }

  const pageType = isSubmissionPage ? "submission" : isPositionRolePage ? "position" : "transition"

  return (
    <div
      id="flashcard-container"
      class={classNames(displayClass, "flashcard-container")}
      data-page-type={pageType}
    >
      <div class="flashcard-collapsed hidden" id="flashcard-collapsed">
        <span class="flashcard-collapsed-label">Knowledge Test</span>
        <span class="flashcard-collapsed-expand">&#9660;</span>
      </div>
      <div class="flashcard" id="flashcard">
        <div class="flashcard-label-row">
          <div class="flashcard-label" id="flashcard-label">
            Knowledge Test
          </div>
          <div class="flashcard-label-actions">
            <button class="flashcard-add-training hidden" id="flashcard-add-training">
              + Add to Training
            </button>
            <button
              class="flashcard-dismiss-btn"
              id="flashcard-dismiss-btn"
              aria-label="Hide flashcard"
              title="Hide Knowledge Test"
            >
              &times;
            </button>
          </div>
        </div>
        <div class="flashcard-question" id="flashcard-question">
          {/* Question populated by JS */}
        </div>
        <div class="flashcard-answer hidden" id="flashcard-answer">
          {/* Answer revealed on click */}
        </div>
        <div class="flashcard-actions">
          <button class="reveal-btn" id="reveal-btn">
            Reveal Answer
          </button>
          <div class="result-btns hidden" id="result-btns">
            <button class="again-btn" id="again-btn">
              Again
            </button>
            <button class="hard-btn" id="hard-btn">
              Hard
            </button>
            <button class="easy-btn" id="easy-btn">
              Easy
            </button>
          </div>
          <button
            class="flashcard-downvote hidden"
            id="flashcard-downvote"
            aria-label="Report question"
            title="Report question"
          >
            &#x1F44E;
          </button>
          <div class="flashcard-feedback hidden" id="flashcard-feedback">
            <div class="feedback-input-row">
              <input
                type="text"
                id="feedback-input"
                class="feedback-input"
                placeholder="What's wrong with this question?"
                maxLength={200}
              />
              <button class="feedback-submit" id="feedback-submit" aria-label="Submit feedback">
                &#x2713;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

TransitionFlashcard.css = `
/* Styles defined in custom.scss */
`

TransitionFlashcard.afterDOMLoaded = script
export default (() => TransitionFlashcard) satisfies QuartzComponentConstructor
