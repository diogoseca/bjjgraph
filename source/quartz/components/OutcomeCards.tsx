import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
// @ts-ignore
import script from "./scripts/outcomeCards.inline"

const OutcomeCards: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const slug = fileData.slug ?? ""
  const slugLower = slug.toLowerCase()
  const isTransitionPage = slugLower.startsWith("transitions/")
  const isSubmissionPage = slugLower.startsWith("submissions/")

  if (!isTransitionPage && !isSubmissionPage) {
    return null
  }

  return (
    <div class={classNames(displayClass, "outcome-cards-container")} style={{ display: "none" }}>
      <div class="outcome-cards-from" id="outcome-from-link"></div>
      <h3 class="outcome-cards-title">Outcomes</h3>
      <div class="outcome-cards" id="outcome-cards"></div>
    </div>
  )
}

OutcomeCards.css = `/* Styles defined in custom.scss */`
OutcomeCards.afterDOMLoaded = script
export default (() => OutcomeCards) satisfies QuartzComponentConstructor
