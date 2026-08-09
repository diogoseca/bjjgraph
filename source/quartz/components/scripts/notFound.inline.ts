// Client-side script for 404 page - detects URL, constructs GitHub issue links,
// fuzzy-matches similar pages, and triggers search

const REPO_URL = "https://github.com/diogoseca/bjjgraph"

/**
 * Simple Levenshtein distance for fuzzy matching
 */
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

/**
 * Score a candidate slug/title against the attempted path.
 * Lower score = better match. Combines Levenshtein distance with substring bonuses.
 */
function matchScore(attempted: string, candidateSlug: string, candidateTitle: string): number {
  const normalizedAttempt = attempted.toLowerCase().replace(/[-_/]/g, " ").trim()
  const normalizedSlug = candidateSlug.toLowerCase().replace(/[-_/]/g, " ").trim()
  const normalizedTitle = candidateTitle.toLowerCase().trim()

  // Check for substring containment (strong signal)
  const words = normalizedAttempt.split(/\s+/).filter((w) => w.length > 2)
  let substringBonus = 0
  for (const word of words) {
    if (normalizedSlug.includes(word) || normalizedTitle.includes(word)) {
      substringBonus -= 10 // Negative = better
    }
  }

  const slugDist = levenshtein(normalizedAttempt, normalizedSlug)
  const titleDist = levenshtein(normalizedAttempt, normalizedTitle)
  const bestDist = Math.min(slugDist, titleDist)

  return bestDist + substringBonus
}

/**
 * Find the single best matching page from the content index.
 */
async function findBestMatch(
  attemptedPath: string,
): Promise<{ slug: string; title: string } | null> {
  try {
    // Lazy-load content index (only on 404 pages)
    const loadContentIndex = (window as any).loadContentIndex
    const data = loadContentIndex ? await loadContentIndex() : await (window as any).fetchData
    if (!data) return null

    let bestMatch: { slug: string; title: string } | null = null
    let bestScore = Infinity

    const cleanPath = attemptedPath.replace(/^\//, "").replace(/\/$/, "")

    for (const [slug, fileData] of Object.entries(data)) {
      const title = (fileData as any).title ?? slug
      if (slug === "index" || slug === "404" || slug === "game-over") continue
      if (slug === cleanPath) continue

      const score = matchScore(cleanPath, slug as string, title as string)
      if (score < bestScore) {
        bestScore = score
        bestMatch = { slug: slug as string, title: title as string }
      }
    }

    // Only return if the match is reasonably close
    if (bestMatch && bestScore < cleanPath.length * 0.8) {
      // For role pages (Attacker/Defender/Top/Bottom), build a descriptive title
      // from the parent page's title, e.g. "Loop Choke from Mount (Attacker)"
      const roleSuffixes = ["Attacker", "Defender", "Top", "Bottom"]
      const lastSegment = bestMatch.slug.split("/").pop() ?? ""
      if (roleSuffixes.includes(lastSegment)) {
        const parentSlug = bestMatch.slug.split("/").slice(0, -1).join("/")
        const parentData = data[parentSlug] as any
        if (parentData?.title) {
          const parentTitle = (parentData.title as string).replace(/\s*\|.*$/, "")
          bestMatch.title = `${parentTitle} (${lastSegment})`
        }
      }
      return bestMatch
    }
    return null
  } catch {
    return null
  }
}

/**
 * Convert a pathname like "/Positions/Mount-Control" into "Positions / Mount Control"
 */
function formatPath(pathname: string): string {
  const clean = pathname.replace(/^\//, "").replace(/\/$/, "")
  return decodeURIComponent(clean).replace(/-/g, " ").replace(/\//g, " / ")
}

/**
 * Get the last segment of a path as a readable search term.
 */
function lastSegmentReadable(pathname: string): string {
  const clean = pathname.replace(/^\//, "").replace(/\/$/, "")
  const last = clean.split("/").pop() ?? clean
  return decodeURIComponent(last).replace(/-/g, " ")
}

/**
 * The 404 page is rendered with slug "404" but served from any unmatched URL,
 * so the URL bar may be deeper than the page assumes (e.g. /Submissions/Loop-Choke/foo).
 * Without intervention, relative URLs in sidebar/nav resolve against the wrong base
 * (e.g. ../Principles/X resolves to /Submissions/Loop-Choke/Principles/X instead of /Principles/X).
 * Inject <base href="/"> so all relative URLs resolve against the site root.
 */
function ensureBaseTag() {
  if (document.body.dataset.slug !== "404") return
  let baseTag = document.head.querySelector("base") as HTMLBaseElement | null
  if (!baseTag) {
    baseTag = document.createElement("base")
    baseTag.setAttribute("href", "/")
    document.head.insertBefore(baseTag, document.head.firstChild)
  } else if (baseTag.getAttribute("href") !== "/") {
    baseTag.setAttribute("href", "/")
  }
}

function initNotFoundPage() {
  // 404 ONLY. This ran on every page in the site: ensureBaseTag was slug-gated but nothing else
  // was, so findBestMatch() below fetched static/contentIndex.json.gz — 3.4MB, the search index —
  // on every single page load, to power a "did you mean" line that only the 404 page renders.
  // It was the second-heaviest item in the first-paint payload after the Neural dossier bundle
  // (measured by e2e/journeys/payload-first-hand.spec.ts, v1.80.4).
  if (document.body?.dataset.slug !== "404") return
  ensureBaseTag()
  const pathname = window.location.pathname
  const titleEl = document.getElementById("not-found-title")
  const pathDisplay = document.getElementById("not-found-path")
  const createLink = document.getElementById("create-page-link") as HTMLAnchorElement | null
  const didYouMeanContainer = document.getElementById("did-you-mean")
  const didYouMeanLink = document.getElementById("did-you-mean-link") as HTMLAnchorElement | null
  const openSearchBtn = document.getElementById("open-search-btn")

  const pageName = lastSegmentReadable(pathname)

  // Set the title to: \u201CMount\u201D page not found
  if (titleEl && pageName) {
    titleEl.textContent = `\u201C${pageName}\u201D page not found`
  }

  // Show the raw URL path as a subtitle
  if (pathDisplay) {
    pathDisplay.textContent = pathname
  }

  // Construct the GitHub issue URL for "Request this page"
  if (createLink) {
    const cleanPath = pathname.replace(/^\//, "").replace(/\/$/, "")

    let contentTypeHint = ""
    if (cleanPath.startsWith("Positions/")) {
      contentTypeHint = "Position"
    } else if (cleanPath.startsWith("Transitions/")) {
      contentTypeHint = "Transition"
    } else if (cleanPath.startsWith("Submissions/")) {
      contentTypeHint = "Submission"
    } else if (cleanPath.startsWith("Systems/")) {
      contentTypeHint = "System"
    } else if (cleanPath.startsWith("Principles/")) {
      contentTypeHint = "Principle"
    }

    const issueBody = `## Page Request

**Requested Path:** \`${pathname}\`
**Expected File:** \`content/${cleanPath}.md\`
${contentTypeHint ? `**Detected Type:** ${contentTypeHint}` : ""}

## Content Type
<!-- Is this a Position, Transition, Submission, or other? -->
${contentTypeHint ? contentTypeHint : ""}

## Suggested Content
<!-- What should this page contain? -->

---

@claude Please create this page following the project standards in CLAUDE.md and docs/Content.md.
`

    const issueUrl = new URL(`${REPO_URL}/issues/new`)
    issueUrl.searchParams.set("title", `Request: Create page at ${pathname}`)
    issueUrl.searchParams.set("body", issueBody)
    issueUrl.searchParams.set("labels", "enhancement,good first issue")

    createLink.href = issueUrl.toString()
  }

  // Find and display the best fuzzy match
  findBestMatch(pathname).then((match) => {
    if (match && didYouMeanContainer && didYouMeanLink) {
      didYouMeanLink.href = `/${match.slug}`
      didYouMeanLink.textContent = match.title.replace(/\s*\|.*$/, "")
      didYouMeanContainer.style.display = ""
    }
  })

  // Wire up the search trigger button to open Quartz search overlay
  if (openSearchBtn) {
    openSearchBtn.addEventListener("click", () => {
      const searchButton = document.getElementById("search-button")
      if (searchButton) {
        searchButton.click()
        // Pre-fill the search bar with the last path segment
        setTimeout(() => {
          const searchBar = document.getElementById("search-bar") as HTMLInputElement | null
          if (searchBar) {
            searchBar.value = lastSegmentReadable(pathname)
            searchBar.dispatchEvent(new Event("input", { bubbles: true }))
          }
        }, 100)
      }
    })
  }
}

// Run on Quartz SPA navigation
document.addEventListener("nav", initNotFoundPage)

// Also run immediately for direct page loads
if (document.readyState !== "loading") {
  initNotFoundPage()
}
