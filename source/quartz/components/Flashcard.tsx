import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
// @ts-ignore
import script from "./scripts/flashcard.inline"

type PageType = "transition" | "submission" | "position" | "principle" | "system"

const SECTIONS: Array<{ prefix: string; type: PageType }> = [
  { prefix: "transitions/", type: "transition" },
  { prefix: "submissions/", type: "submission" },
  { prefix: "positions/", type: "position" },
  { prefix: "principles/", type: "principle" },
  { prefix: "systems/", type: "system" },
]

const Flashcard: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const slug = fileData.slug ?? ""
  const slugLower = slug.toLowerCase()

  const section = SECTIONS.find((s) => slugLower.startsWith(s.prefix))
  if (!section) return null

  return (
    <div
      id="flashcard-container"
      class={classNames(displayClass, "flashcard-container", "flashcard-minimized")}
      data-page-type={section.type}
    >
      <div class="flashcard-min" id="flashcard-min" role="button" tabIndex={0}>
        <span class="flashcard-min-icon" aria-hidden="true">
          ?
        </span>
        <span class="flashcard-min-question" id="flashcard-min-question"></span>
        <button
          type="button"
          class="flashcard-min-show"
          id="flashcard-min-show"
          aria-label="Show answer"
        >
          Show Answer
        </button>
      </div>
      <div class="flashcard hidden" id="flashcard">
        <div class="flashcard-label-row">
          <span class="flashcard-icon" aria-hidden="true">
            ?
          </span>
          <div class="flashcard-label-actions">
            <button class="flashcard-add-training hidden" id="flashcard-add-training">
              + Add to Training
            </button>
            <button
              type="button"
              class="flashcard-help-btn"
              id="flashcard-help-btn"
              aria-label="Keyboard shortcuts"
              data-tooltip={
                "Keyboard shortcuts\n" +
                "Space — Show Answer\n" +
                "1 — Again\n" +
                "2 — Hard\n" +
                "3 — Easy\n" +
                "4 — Skip"
              }
            >
              &#x2328;
            </button>
          </div>
        </div>
        <div class="flashcard-question" id="flashcard-question"></div>
        <div class="flashcard-answer hidden" id="flashcard-answer"></div>
        <div class="flashcard-actions">
          <button class="reveal-btn hidden" id="reveal-btn">
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
            <button
              class="skip-btn"
              id="skip-btn"
              title="Skip this flashcard and hide it from future reviews"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

Flashcard.css = `
/* Styles defined in custom.scss */
`

Flashcard.afterDOMLoaded = script
export default (() => Flashcard) satisfies QuartzComponentConstructor
