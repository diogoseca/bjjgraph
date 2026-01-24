import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
// @ts-ignore
import script from "./scripts/flashcard.inline"

const TransitionFlashcard: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const slug = fileData.slug ?? ""

  // Only render on transition and submission pages
  const isTransitionPage = slug.startsWith("Transitions/")
  const isSubmissionPage = slug.startsWith("Submissions/")

  if (!isTransitionPage && !isSubmissionPage) {
    return null
  }

  const pageType = isSubmissionPage ? "submission" : "transition"

  return (
    <div id="flashcard-container" class={classNames(displayClass, "flashcard-container")} data-page-type={pageType}>
      <div class="flashcard" id="flashcard">
        <div class="flashcard-label" id="flashcard-label">Knowledge Test</div>
        <div class="flashcard-question" id="flashcard-question">
          {/* Question populated by JS */}
        </div>
        <div class="flashcard-answer hidden" id="flashcard-answer">
          {/* Answer revealed on click */}
        </div>
        <div class="flashcard-actions">
          <button class="reveal-btn" id="reveal-btn">Reveal Answer</button>
          <div class="result-btns hidden" id="result-btns">
            <button class="remembered-btn" id="remembered-btn">I remembered</button>
            <button class="missed-btn" id="missed-btn">I missed it</button>
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
