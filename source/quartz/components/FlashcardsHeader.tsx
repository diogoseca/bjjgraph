import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import script from "./scripts/flashcardsHeader.inline"

const FlashcardsHeader: QuartzComponent = () => {
  // [data-persist] — micromorph preserves this element across SPA navs so
  // we don't flicker on every page change. Runtime updates label + play
  // glyph on each "nav" event.
  return (
    <div id="flashcards-header" class="flashcards-header" data-persist>
      <button
        type="button"
        class="flashcards-header-label"
        id="flashcards-header-label"
        aria-label="Open training decks"
      >
        Flashcards
      </button>
      <button
        type="button"
        class="flashcards-header-play"
        id="flashcards-header-play"
        aria-label="Start training session"
        title="Start session"
      >
        <svg
          class="flashcards-header-icon-play"
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <polygon points="6 4 20 12 6 20"></polygon>
        </svg>
        <svg
          class="flashcards-header-icon-stop"
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <rect x="5" y="5" width="14" height="14"></rect>
        </svg>
      </button>
    </div>
  )
}

FlashcardsHeader.css = `/* Styles defined in custom.scss */`

FlashcardsHeader.afterDOMLoaded = script
export default (() => FlashcardsHeader) satisfies QuartzComponentConstructor
