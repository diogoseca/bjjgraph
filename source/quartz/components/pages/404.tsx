import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import style from "../styles/notFound.scss"

// @ts-ignore
import script from "../scripts/notFound.inline"

const NotFound: QuartzComponent = ({ cfg }: QuartzComponentProps) => {
  const url = new URL(`https://${cfg.baseUrl ?? "example.com"}`)
  const baseDir = url.pathname

  return (
    <article class="popover-hint not-found-page">
      <h1 id="not-found-title" class="not-found-title">
        Page Not Found
      </h1>
      <p class="not-found-subtitle" id="not-found-path"></p>
      <p class="not-found-message">This page does not exist yet.</p>

      <div id="did-you-mean" class="did-you-mean" style="display: none;">
        <span class="did-you-mean-label">Did you mean</span>
        <a id="did-you-mean-link" href="#" class="did-you-mean-suggestion"></a>
        <span class="did-you-mean-label">?</span>
      </div>

      <div class="not-found-actions">
        <a
          href="#"
          id="create-page-link"
          class="action-button request-button"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          Request this page
        </a>

        <button id="open-search-btn" class="action-button search-button" type="button">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Search similar pages
        </button>
      </div>

      <div class="home-fallback">
        <a href={baseDir} class="home-link">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back to homepage
        </a>
      </div>
    </article>
  )
}

NotFound.css = style
NotFound.afterDOMLoaded = script

export default (() => NotFound) satisfies QuartzComponentConstructor
