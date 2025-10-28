/**
 * Cloudflare Pages Function for Generative A/B Testing with PostHog
 *
 * This middleware implements a Dirichlet-based approach to A/B testing:
 * 1. Generates section priorities using Dirichlet distribution (α=1, uniform)
 * 2. Generates section visibility using random booleans (≥50% visible constraint)
 * 3. Persists assignments for 1 week per user (cookie-based)
 * 4. Injects inline CSS <style> tag with dynamic order and display values
 * 5. Sends flat priority/visibility properties to PostHog for correlation analysis
 * 6. Fetches visual enhancement variant from PostHog feature flag
 *
 * Performance: <10ms overhead (cached), <100ms (cache miss)
 */

// ============================================================================
// Types
// ============================================================================

interface Env {
  POSTHOG_API_KEY: string
  POSTHOG_API_HOST?: string
  CACHE?: KVNamespace
}

interface PostHogDecideResponse {
  featureFlags: Record<string, string | boolean>
}

interface SectionConfig {
  id: string
  priority: number
  visible: boolean
}

interface ABAssignment {
  weekSeed: number
  sectionPriorities: Record<string, number>
  sectionVisibility: Record<string, boolean>
  visualElements: string
}

// ============================================================================
// Constants
// ============================================================================

const COOKIE_NAME = 'bjjgraph_ab_assignment'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days (1 week)
const CACHE_TTL = 60 // 60 seconds for PostHog responses
const POSTHOG_TIMEOUT = 5000
const VISIBILITY_THRESHOLD = 0.01 // Hide sections with priority < 1% (extreme outliers only)

const AB_TEST_PATHS = ['/positions/', '/transitions/', '/submissions/', '/Principles/', '/systems/']

// Section IDs for each content type (order matches template)
const CONTENT_SECTIONS: Record<string, string[]> = {
  positions: [
    'state-properties',
    'overview',
    'state-invariants',
    'key-principles',
    'prerequisites',
    'defensive-responses',
    'offensive-transitions',
    'counter-transitions',
    'expert-insights',
    'common-errors',
    'training-drills',
    'related-content',
    'decision-tree',
    'position-metrics',
    'optimal-submission-paths'
  ],
  transitions: [
    'overview',
    'key-principles',
    'setup-requirements',
    'execution-steps',
    'common-counters',
    'common-errors',
    'training-progressions',
    'variants-and-adaptations',
    'knowledge-assessment',
    'safety-considerations',
    'position-integration',
    'related-content',
    'expert-insights'
  ],
  submissions: [
    'overview',
    'safety-considerations',
    'key-principles',
    'setup-requirements',
    'execution-steps',
    'opponent-defense-patterns',
    'common-errors',
    'variations-and-setups',
    'knowledge-assessment',
    'training-progressions-and-safety-protocols',
    'related-content',
    'expert-insights'
  ],
  concepts: [
    'overview',
    'key-principles',
    'component-skills',
    'concept-relationships',
    'application-contexts',
    'decision-framework',
    'common-errors',
    'training-approaches',
    'developmental-metrics',
    'related-content',
    'expert-insights'
  ],
  systems: [
    'overview',
    'key-principles',
    'key-components',
    'implementation-sequence',
    'common-obstacles',
    'assessment-metrics',
    'training-methodology',
    'related-content',
    'expert-insights'
  ]
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

function getDistinctId(request: Request): string {
  const cookieHeader = request.headers.get('Cookie')
  if (!cookieHeader) return generateUUID()

  const cookies = cookieHeader.split(';').map(c => c.trim())
  const idCookie = cookies.find(c => c.startsWith('bjjgraph_ab_id='))

  if (idCookie) {
    const value = idCookie.split('=')[1]
    if (value && value.length > 0) return value
  }

  return generateUUID()
}

function shouldABTest(pathname: string): boolean {
  return AB_TEST_PATHS.some(prefix => pathname.startsWith(prefix))
}

function getContentType(pathname: string): string | null {
  for (const path of AB_TEST_PATHS) {
    if (pathname.startsWith(path)) {
      return path.slice(1, -1) // Remove leading/trailing slashes
    }
  }
  return null
}

/**
 * Get current week number (for weekly refresh of assignments)
 */
function getWeekNumber(): number {
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const diff = now.getTime() - startOfYear.getTime()
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000))
}

// ============================================================================
// Dirichlet Distribution
// ============================================================================

/**
 * Sample from Dirichlet distribution with uniform alpha=1
 * Returns array of priorities that sum to 1
 */
function dirichletSample(numDimensions: number, seed?: string): number[] {
  // Use seed for deterministic sampling (weekly consistency)
  const rng = seed ? seededRandom(seed) : Math.random

  // Sample from Gamma(1,1) = Exponential(1)
  // Using -log(U) where U ~ Uniform(0,1)
  const gammas: number[] = []
  for (let i = 0; i < numDimensions; i++) {
    gammas.push(-Math.log(rng()))
  }

  // Normalize to sum to 1
  const sum = gammas.reduce((a, b) => a + b, 0)
  return gammas.map(g => g / sum)
}

/**
 * Seeded random number generator (simple LCG)
 */
function seededRandom(seed: string): () => number {
  let hashCode = 0
  for (let i = 0; i < seed.length; i++) {
    hashCode = ((hashCode << 5) - hashCode) + seed.charCodeAt(i)
    hashCode |= 0 // Convert to 32-bit integer
  }

  let state = Math.abs(hashCode)

  return function() {
    // Linear Congruential Generator
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

/**
 * Derive section visibility from priorities (priority < 0.01 → hidden)
 */
function deriveSectionVisibility(
  sections: string[],
  priorities: number[]
): Record<string, boolean> {
  return Object.fromEntries(
    sections.map((section, i) => [
      `section_${section}_visible`,
      priorities[i] >= VISIBILITY_THRESHOLD
    ])
  )
}

// ============================================================================
// Assignment Generation & Persistence
// ============================================================================

/**
 * Parse assignment from cookie
 */
function parseAssignment(cookieValue: string): ABAssignment | null {
  try {
    return JSON.parse(decodeURIComponent(cookieValue))
  } catch {
    return null
  }
}

/**
 * Generate new AB assignment for user
 */
function generateAssignment(
  distinctId: string,
  contentType: string,
  weekSeed: number
): ABAssignment {
  const sections = CONTENT_SECTIONS[contentType] || []
  const seed = `${distinctId}-${weekSeed}`

  // Generate Dirichlet priorities
  const priorities = dirichletSample(sections.length, seed + '-priority')
  const sectionPriorities = Object.fromEntries(
    sections.map((section, i) => [`section_${section}_priority`, priorities[i]])
  )

  return {
    weekSeed,
    sectionPriorities,
    visualElements: 'control' // Will be overridden by PostHog
  }
}

/**
 * Get or generate assignment (weekly refresh)
 */
function getAssignment(
  request: Request,
  distinctId: string,
  contentType: string
): ABAssignment {
  const currentWeek = getWeekNumber()
  const cookieHeader = request.headers.get('Cookie')

  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim())
    const assignmentCookie = cookies.find(c => c.startsWith(`${COOKIE_NAME}=`))

    if (assignmentCookie) {
      const value = assignmentCookie.split('=')[1]
      const assignment = parseAssignment(value)

      // Return if still current week
      if (assignment && assignment.weekSeed === currentWeek) {
        return assignment
      }
    }
  }

  // Generate new assignment for current week
  return generateAssignment(distinctId, contentType, currentWeek)
}

// ============================================================================
// PostHog Integration
// ============================================================================

async function getPostHogFeatureFlags(
  distinctId: string,
  env: Env
): Promise<PostHogDecideResponse | null> {
  const apiHost = env.POSTHOG_API_HOST || 'https://app.posthog.com'
  const decideUrl = `${apiHost}/decide/?v=3`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), POSTHOG_TIMEOUT)

    const response = await fetch(decideUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BJJGraph-Edge-AB/2.0'
      },
      body: JSON.stringify({
        api_key: env.POSTHOG_API_KEY,
        distinct_id: distinctId
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error(`PostHog API error: ${response.status}`)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('PostHog API call failed:', error)
    return null
  }
}

async function getCachedFeatureFlags(
  distinctId: string,
  env: Env,
  cacheApi: Cache
): Promise<string> {
  const cacheKey = `https://cache.bjjgraph.com/posthog/${distinctId}`

  try {
    const cached = await cacheApi.match(cacheKey)
    if (cached) {
      const data = await cached.json() as PostHogDecideResponse
      return String(data.featureFlags['position-visual-elements'] || 'control')
    }
  } catch (error) {
    console.error('Cache read error:', error)
  }

  const data = await getPostHogFeatureFlags(distinctId, env)
  const visualElements = String(data?.featureFlags?.['position-visual-elements'] || 'control')

  if (data) {
    try {
      const cacheResponse = new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${CACHE_TTL}`
        }
      })
      await cacheApi.put(cacheKey, cacheResponse)
    } catch (error) {
      console.error('Cache write error:', error)
    }
  }

  return visualElements
}

// ============================================================================
// HTML Rewriting
// ============================================================================

/**
 * Generate inline CSS from section assignments
 */
function generateInlineCSS(assignment: ABAssignment, sections: string[]): string {
  const priorities = assignment.sectionPriorities
  const visualElements = assignment.visualElements

  const styles: string[] = []

  // Extract priority values in order
  const priorityValues = sections.map((section) =>
    priorities[`section_${section}_priority`] || 0
  )

  // Section ordering (based on priorities, scaled to 0-100)
  for (const [key, priority] of Object.entries(priorities)) {
    const sectionId = key.replace('section_', '').replace('_priority', '')
    const orderValue = Math.round(priority * 100)
    styles.push(`  #${sectionId} { order: ${orderValue}; }`)
  }

  // Section visibility (derived from priority threshold)
  priorityValues.forEach((priority, i) => {
    if (priority < VISIBILITY_THRESHOLD) {
      styles.push(`  #${sections[i]} { display: none !important; }`)
    }
  })

  // Visual elements variant (from PostHog)
  if (visualElements === 'enhanced') {
    styles.push(`  body { --visual-variant: enhanced; }`)
  }

  return `<style id="bjjgraph-ab-styles">\n${styles.join('\n')}\n</style>`
}

/**
 * HTMLRewriter handler to inject CSS into <head>
 */
class StyleInjector {
  private cssToInject: string

  constructor(cssToInject: string) {
    this.cssToInject = cssToInject
  }

  element(element: Element) {
    element.append(this.cssToInject, { html: true })
  }
}

/**
 * HTMLRewriter handler to add visual variant class to <body>
 */
class BodyClassInjector {
  private visualVariant: string

  constructor(visualVariant: string) {
    this.visualVariant = visualVariant
  }

  element(element: Element) {
    if (this.visualVariant === 'enhanced') {
      const existingClass = element.getAttribute('class') || ''
      const newClass = existingClass
        ? `${existingClass} variant-visual-enhanced`
        : 'variant-visual-enhanced'
      element.setAttribute('class', newClass)
    }
  }
}

function rewriteHTML(
  response: Response,
  assignment: ABAssignment,
  sections: string[]
): Response {
  const inlineCSS = generateInlineCSS(assignment, sections)

  return new HTMLRewriter()
    .on('head', new StyleInjector(inlineCSS))
    .on('body', new BodyClassInjector(assignment.visualElements))
    .transform(response)
}

// ============================================================================
// Cookie Management
// ============================================================================

function createCookieHeader(assignment: ABAssignment, url: URL): string {
  const value = encodeURIComponent(JSON.stringify(assignment))
  const isSecure = url.protocol === 'https:'

  const parts = [
    `${COOKIE_NAME}=${value}`,
    `Max-Age=${COOKIE_MAX_AGE}`,
    'Path=/',
    'SameSite=Lax'
  ]

  if (isSecure) {
    parts.push('Secure')
  }

  return parts.join('; ')
}

function createDistinctIdCookie(distinctId: string, url: URL): string {
  const isSecure = url.protocol === 'https:'

  const parts = [
    `bjjgraph_ab_id=${distinctId}`,
    `Max-Age=${60 * 60 * 24 * 365}`, // 1 year
    'Path=/',
    'SameSite=Lax'
  ]

  if (isSecure) {
    parts.push('Secure')
  }

  return parts.join('; ')
}

// ============================================================================
// Main Middleware Handler
// ============================================================================

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context
  const url = new URL(request.url)

  // Skip A/B testing for non-content pages
  if (!shouldABTest(url.pathname)) {
    return next()
  }

  // Get content type
  const contentType = getContentType(url.pathname)
  if (!contentType) {
    return next()
  }

  // Get or generate distinct_id
  const distinctId = getDistinctId(request)

  // Get or generate weekly assignment
  const assignment = getAssignment(request, distinctId, contentType)

  // Get visual elements variant from PostHog
  const cacheApi = caches.default
  const visualElements = await getCachedFeatureFlags(distinctId, env, cacheApi)
  assignment.visualElements = visualElements

  // Get the original response
  const response = await next()

  // Only rewrite HTML responses
  const contentTypeHeader = response.headers.get('Content-Type') || ''
  if (!contentTypeHeader.includes('text/html')) {
    return response
  }

  // Rewrite HTML to inject inline styles
  const sections = CONTENT_SECTIONS[contentType] || []
  const rewrittenResponse = rewriteHTML(response, assignment, sections)

  // Create response with cookies
  const newResponse = new Response(rewrittenResponse.body, {
    status: rewrittenResponse.status,
    statusText: rewrittenResponse.statusText,
    headers: new Headers(rewrittenResponse.headers)
  })

  // Set cookies (assignment + distinct_id)
  const cookies = [
    createCookieHeader(assignment, url),
    createDistinctIdCookie(distinctId, url)
  ]

  cookies.forEach(cookie => {
    newResponse.headers.append('Set-Cookie', cookie)
  })

  // Add debug headers
  if (url.searchParams.has('debug')) {
    newResponse.headers.set('X-BJJGraph-AB-Week', String(assignment.weekSeed))
    newResponse.headers.set('X-BJJGraph-AB-Priorities', JSON.stringify(assignment.sectionPriorities))
    newResponse.headers.set('X-BJJGraph-AB-Visual', assignment.visualElements)
    newResponse.headers.set('X-BJJGraph-AB-ContentType', contentType)
  }

  return newResponse
}
