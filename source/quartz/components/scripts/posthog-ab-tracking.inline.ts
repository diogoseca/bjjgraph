/**
 * PostHog A/B Testing Event Tracking (Client-Side)
 *
 * This script:
 * 1. Reads assignment cookie from edge
 * 2. Parses section priorities
 * 3. Derives section visibility (priority >= 0.01)
 * 4. Sends flat properties to PostHog for correlation analysis
 * 5. Tracks time on page and scroll depth
 */

interface PostHogType {
  capture: (event: string, properties?: Record<string, any>) => void
  onFeatureFlags?: (callback: () => void) => void
}

declare global {
  interface Window {
    posthog?: PostHogType
  }
}

const VISIBILITY_THRESHOLD = 0.01
const pageLoadTime = Date.now()

/**
 * Get page metadata
 */
function getPageMetadata() {
  const bodyEl = document.body
  const slug = bodyEl.dataset.slug || window.location.pathname
  const pathParts = slug.split('/').filter(Boolean)
  const contentType = pathParts[0] || 'unknown'
  const pageName = pathParts[pathParts.length - 1] || 'unknown'

  return { slug, contentType, pageName, url: window.location.href }
}

/**
 * Parse assignment cookie
 */
function getAssignmentFromCookie(): any | null {
  const cookieValue = document.cookie
    .split('; ')
    .find(row => row.startsWith('bjjgraph_ab_assignment='))
    ?.split('=')[1]

  if (!cookieValue) return null

  try {
    return JSON.parse(decodeURIComponent(cookieValue))
  } catch {
    return null
  }
}

/**
 * Derive visibility from priorities
 */
function deriveVisibility(sectionPriorities: Record<string, number>): Record<string, boolean> {
  const visibility: Record<string, boolean> = {}

  for (const [key, priority] of Object.entries(sectionPriorities)) {
    const sectionId = key.replace('_priority', '_visible')
    visibility[sectionId] = priority >= VISIBILITY_THRESHOLD
  }

  return visibility
}

/**
 * Send A/B assignment data to PostHog
 */
function trackABPageView(posthog: PostHogType) {
  const metadata = getPageMetadata()

  // Only track for content pages
  if (!['positions', 'transitions', 'submissions', 'concepts', 'systems'].includes(metadata.contentType)) {
    return
  }

  const assignment = getAssignmentFromCookie()
  if (!assignment) {
    console.warn('[BJJ Graph AB] No assignment cookie found')
    return
  }

  // Derive visibility from priorities
  const sectionVisibility = deriveVisibility(assignment.sectionPriorities)

  // Flatten all data for PostHog
  const eventData = {
    ...metadata,
    week_seed: assignment.weekSeed,
    visual_elements: assignment.visualElements,
    ...assignment.sectionPriorities, // Flat: section_decision_tree_priority: 0.23
    ...sectionVisibility // Flat: section_decision_tree_visible: true
  }

  posthog.capture('ab_page_view', eventData)
}

/**
 * Track time on page
 */
function trackTimeOnPage(posthog: PostHogType) {
  const metadata = getPageMetadata()

  if (!['positions', 'transitions', 'submissions', 'concepts', 'systems'].includes(metadata.contentType)) {
    return
  }

  const trackLeave = () => {
    const timeOnPage = Math.round((Date.now() - pageLoadTime) / 1000)
    const assignment = getAssignmentFromCookie()

    posthog.capture('ab_time_on_page', {
      ...metadata,
      time_on_page: timeOnPage,
      week_seed: assignment?.weekSeed,
      visual_elements: assignment?.visualElements
    })
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') trackLeave()
  })

  window.addEventListener('beforeunload', trackLeave)

  document.addEventListener('nav', (e: Event) => {
    const customEvent = e as CustomEvent
    const newUrl = customEvent.detail?.url
    if (newUrl && newUrl !== metadata.slug) trackLeave()
  })
}

/**
 * Track scroll depth
 */
function trackScrollDepth(posthog: PostHogType) {
  const metadata = getPageMetadata()

  if (!['positions', 'transitions', 'submissions', 'concepts', 'systems'].includes(metadata.contentType)) {
    return
  }

  const milestones = [25, 50, 75, 100]
  const reached = new Set<number>()

  const checkScroll = () => {
    const scrollPercentage = Math.round(
      ((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100
    )

    milestones.forEach(milestone => {
      if (scrollPercentage >= milestone && !reached.has(milestone)) {
        reached.add(milestone)

        const assignment = getAssignmentFromCookie()
        posthog.capture('ab_scroll_depth', {
          ...metadata,
          scroll_depth: milestone,
          week_seed: assignment?.weekSeed,
          visual_elements: assignment?.visualElements
        })
      }
    })
  }

  let scrollTimeout: number | undefined
  window.addEventListener('scroll', () => {
    if (scrollTimeout) clearTimeout(scrollTimeout)
    scrollTimeout = window.setTimeout(checkScroll, 200) as any
  }, { passive: true })
}

/**
 * Wait for PostHog to load
 */
function waitForPostHog(callback: (posthog: PostHogType) => void, maxAttempts = 50) {
  let attempts = 0

  const checkPostHog = () => {
    attempts++

    if (window.posthog && typeof window.posthog.capture === 'function') {
      callback(window.posthog)
    } else if (attempts < maxAttempts) {
      setTimeout(checkPostHog, 100)
    } else {
      console.warn('[BJJ Graph AB] PostHog not loaded after 5s')
    }
  }

  checkPostHog()
}

/**
 * Initialize tracking
 */
function initABTracking() {
  waitForPostHog((posthog) => {
    trackABPageView(posthog)
    trackTimeOnPage(posthog)
    trackScrollDepth(posthog)
    console.log('[BJJ Graph AB] Tracking initialized')
  })
}

// Start on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initABTracking)
} else {
  initABTracking()
}

// Re-initialize on SPA navigation
document.addEventListener('nav', initABTracking)
