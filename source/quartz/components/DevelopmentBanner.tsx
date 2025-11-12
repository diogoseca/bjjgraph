import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/developmentBanner.scss"

declare global {
  interface Window {
    posthog?: {
      capture: (event: string, properties?: Record<string, any>) => void
      activateSurvey?: (surveyId: string) => void
    }
  }
}

export default (() => {
  const DevelopmentBanner: QuartzComponent = ({ displayClass }: QuartzComponentProps) => {
    const handleBugReport = () => {
      if (!window.posthog) {
        console.warn('[BJJ Graph] PostHog not loaded')
        return
      }

      const pageContext = {
        url: window.location.href,
        pathname: window.location.pathname,
        contentType: document.body?.dataset?.contentType || 'unknown',
        timestamp: new Date().toISOString()
      }

      // Trigger bug report survey
      if (window.posthog.activateSurvey) {
        window.posthog.activateSurvey('019a779c-fdd6-0000-0041-2242f1930b08')
      }

      // Also capture event with context for tracking
      window.posthog.capture('feedback_bug_report_clicked', pageContext)
    }

    const handleSuggestion = () => {
      if (!window.posthog) {
        console.warn('[BJJ Graph] PostHog not loaded')
        return
      }

      const pageContext = {
        url: window.location.href,
        pathname: window.location.pathname,
        contentType: document.body?.dataset?.contentType || 'unknown',
        timestamp: new Date().toISOString()
      }

      // Trigger suggestion survey
      if (window.posthog.activateSurvey) {
        window.posthog.activateSurvey('019a779d-0b25-0000-b507-fa1ccefb3710')
      }

      // Also capture event with context for tracking
      window.posthog.capture('feedback_suggestion_clicked', pageContext)
    }

    return (
      <div class={`development-banner ${displayClass ?? ""}`}>
        <div class="banner-content">
          <span class="banner-text">
            <span class="banner-emoji">🚧</span>
            <span class="banner-message">Under Rapid Development</span>
          </span>
          <div class="banner-actions">
            <button onClick={handleBugReport} class="banner-button bug">
              Report Issue
            </button>
            <button onClick={handleSuggestion} class="banner-button enhancement">
              Suggest Improvement
            </button>
          </div>
        </div>
      </div>
    )
  }

  DevelopmentBanner.css = style
  return DevelopmentBanner
}) satisfies QuartzComponentConstructor
