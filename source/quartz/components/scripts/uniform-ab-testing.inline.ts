/**
 * Pure Frontend Uniform Random A/B Testing
 *
 * Ultra-simple A/B testing using uniform random sampling:
 * - Priority: uniform [0,1] for section ordering
 * - Visibility: 10% hide probability, max 33% hidden
 * - Styling: 50% enhanced probability
 *
 * Runs in <head> before body renders (zero FOUC)
 * Persists weekly via cookie
 * Reports to PostHog asynchronously (non-blocking)
 *
 * Zero dependencies on edge workers or PostHog API
 */

// ============================================================================
// Configuration
// ============================================================================

const COOKIE_AB_ID = 'bjjgraph_ab_id'
const COOKIE_ASSIGNMENT = 'bjjgraph_ab_assignment'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

const HIDE_PROBABILITY = 0.10 // 10% chance each section is hidden
const MAX_HIDDEN_RATIO = 0.33 // Max 33% of sections can be hidden
const ENHANCED_PROBABILITY = 0.50 // 50% chance each section gets enhanced styling

// ============================================================================
// Seeded Random Number Generator (for weekly consistency)
// ============================================================================

function seededRandom(seed: string): () => number {
  let hashCode = 0
  for (let i = 0; i < seed.length; i++) {
    hashCode = ((hashCode << 5) - hashCode) + seed.charCodeAt(i)
    hashCode |= 0
  }

  let state = Math.abs(hashCode)

  return function(): number {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function getWeekNumber(): number {
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const diff = now.getTime() - startOfYear.getTime()
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000))
}

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(';').shift()
    return cookieValue ? decodeURIComponent(cookieValue) : null
  }
  return null
}

function setCookie(name: string, value: string, days: number): void {
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`
}

// ============================================================================
// Assignment Generation
// ============================================================================

interface ABAssignment {
  weekSeed: number
  sections: string[]
  contentType: string
  priorities: number[]
  visible: boolean[]
  enhanced: boolean[]
}

function generateAssignment(
  sections: string[],
  contentType: string,
  distinctId: string,
  weekSeed: number
): ABAssignment {
  const k = sections.length
  const seed = `${distinctId}-${weekSeed}`
  const rng = seededRandom(seed)

  // 1. Generate uniform random priorities [0, 1]
  const priorities = Array(k).fill(0).map(() => rng())

  // 2. Generate visibility with 10% hide probability, max 33% hidden
  const visibilityRandom = Array(k).fill(0).map(() => rng())
  const maxHidden = Math.floor(k * MAX_HIDDEN_RATIO)

  let visible = visibilityRandom.map(v => v >= HIDE_PROBABILITY)
  let hiddenCount = visible.filter(v => !v).length

  if (hiddenCount > maxHidden) {
    // Cap exceeded: show sections with highest visibility values until at cap
    const hiddenIndices = visible
      .map((v, i) => ({ visible: v, index: i, value: visibilityRandom[i] }))
      .filter(x => !x.visible)
      .sort((a, b) => b.value - a.value) // Highest visibility values first

    const toShow = hiddenIndices.slice(0, hiddenCount - maxHidden)
    toShow.forEach(x => visible[x.index] = true)
  }

  // 3. Generate visual styling - 50% enhanced probability
  const enhanced = Array(k).fill(0).map(() => rng() > ENHANCED_PROBABILITY)

  return {
    weekSeed,
    sections,
    contentType,
    priorities,
    visible,
    enhanced
  }
}

// ============================================================================
// CSS Application
// ============================================================================

function applyCSS(assignment: ABAssignment): void {
  const cssRules: string[] = []

  assignment.sections.forEach((sectionId, i) => {
    const rules: string[] = []

    // Priority (order)
    rules.push(`order: ${Math.round(assignment.priorities[i] * 1000)}`)

    // Visibility
    if (!assignment.visible[i]) {
      rules.push('display: none !important')
    }

    // Enhanced styling
    if (assignment.enhanced[i]) {
      rules.push('border: 1px solid #e0e0e0')
      rules.push('background: #fafafa')
      rules.push('padding: 1rem')
      rules.push('border-radius: 4px')
      rules.push('margin-bottom: 1.5rem')
    }

    cssRules.push(`#${sectionId} { ${rules.join('; ')} }`)
  })

  const styleEl = document.createElement('style')
  styleEl.id = 'bjjgraph-ab-styles'
  styleEl.innerHTML = cssRules.join('\n')
  document.head.appendChild(styleEl)
}

// ============================================================================
// Initialization
// ============================================================================

function initABTesting(): void {
  // Get sections from body data attribute
  const sectionsAttr = document.body?.dataset?.sections
  if (!sectionsAttr) return

  let sections: string[]
  try {
    sections = JSON.parse(sectionsAttr)
  } catch (e) {
    console.error('[BJJ Graph AB] Failed to parse sections:', e)
    return
  }

  if (sections.length === 0) return

  const contentType = document.body?.dataset?.contentType || 'unknown'

  // Get or create distinct ID
  let distinctId = getCookie(COOKIE_AB_ID)
  if (!distinctId) {
    distinctId = generateUUID()
    setCookie(COOKIE_AB_ID, distinctId, 365)
  }

  const weekSeed = getWeekNumber()

  // Check for cached assignment
  const cachedValue = getCookie(COOKIE_ASSIGNMENT)
  if (cachedValue) {
    try {
      const cached: ABAssignment = JSON.parse(cachedValue)

      // Validate cache: same week and same sections
      if (cached.weekSeed === weekSeed &&
          cached.sections.join(',') === sections.join(',')) {
        applyCSS(cached)
        // PostHog reporting handled by posthog-ab-tracking.inline.ts
        return
      }
    } catch (e) {
      // Invalid cache, continue to generate new
    }
  }

  // Generate new assignment
  const assignment = generateAssignment(sections, contentType, distinctId, weekSeed)
  applyCSS(assignment)
  setCookie(COOKIE_ASSIGNMENT, JSON.stringify(assignment), 7)
  // PostHog reporting handled by posthog-ab-tracking.inline.ts
}

// Run immediately (before DOMContentLoaded to minimize FOUC)
initABTesting()
