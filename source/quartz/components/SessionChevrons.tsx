import { QuartzComponent, QuartzComponentConstructor } from "./types"
// @ts-ignore
import script from "./scripts/sessionChevrons.inline"

// SessionChevrons — fixed-position prev/next overlays shown only when
// body[data-training-active]. Persistent (survives SPA nav via [data-persist])
// because the chevrons should stay visible / re-position smoothly between
// page swaps. CSS hides them by default; the body attribute reveals them.
const SessionChevrons: QuartzComponent = () => {
  return (
    <div id="session-chevrons" class="session-chevrons" data-persist>
      <button
        type="button"
        class="session-chevron session-chevron--prev"
        id="session-chevron-prev"
        aria-label="Previous flashcard"
        title="Previous (←)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <button
        type="button"
        class="session-chevron session-chevron--next"
        id="session-chevron-next"
        aria-label="Next flashcard"
        title="Next (→)"
      >
        <svg
          class="session-chevron-icon-next"
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
        <svg
          class="session-chevron-icon-finish"
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </button>
    </div>
  )
}

SessionChevrons.css = `/* Styles defined in custom.scss */`

SessionChevrons.afterDOMLoaded = script
export default (() => SessionChevrons) satisfies QuartzComponentConstructor
