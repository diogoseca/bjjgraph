// Move Cards - Display available moves on position pages
import { removeAllChildren } from "./util"

interface StateGraph {
  positions: Record<
    string,
    {
      name: string
      hub: string
      role: string
      path?: string
      transitions: Array<{
        technique: string
        target: string
        targetPath?: string
        isSubmission: boolean
        successRate: { intermediate: number; advanced: number }
      }>
      defenses: Array<{
        technique: string
        target: string
        targetPath?: string
        successRate: number
      }>
    }
  >
  transitions: Record<string, any>
  submissions: Record<string, any>
}

let stateGraph: StateGraph | null = null
let pathToKeyIndex: Record<string, string> = {}

async function fetchStateGraph(): Promise<StateGraph | null> {
  if (stateGraph) return stateGraph

  try {
    const baseUrl = document.documentElement.dataset.baseUrl ?? ""
    const response = await fetch(`${baseUrl}/static/stateGraph.json`)
    stateGraph = await response.json()

    // Build a reverse index from path → position key
    // This helps us look up positions by their URL path
    pathToKeyIndex = {}
    if (stateGraph) {
      for (const [key, pos] of Object.entries(stateGraph.positions)) {
        if (pos.path) {
          // Normalize path to lowercase with hyphens for matching
          const normalizedPath = pos.path.toLowerCase().replace(/\s+/g, "-")
          pathToKeyIndex[normalizedPath] = key
        }
        // Also index by the key itself (e.g., "mount/top" → "mount/top")
        pathToKeyIndex[key] = key
      }
    }

    return stateGraph
  } catch (e) {
    console.warn("State graph not available")
    return null
  }
}

function pathFromUrl(url: string): string {
  // Convert URL path like /Positions/Twister-Control/Truck/Top to twister-control/truck/top
  return url
    .replace(/^\/?(Positions|Transitions|Submissions)\//, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
}

function findPositionKey(urlPath: string): string | null {
  // Try direct lookup first
  if (pathToKeyIndex[urlPath]) {
    return pathToKeyIndex[urlPath]
  }

  // Try with slug format (hub/role) for backwards compatibility
  // e.g., "mount/top" should match directly
  const parts = urlPath.split("/")
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1]
    if (lastPart === "top" || lastPart === "bottom") {
      // Try hub + role format
      const hub = parts[parts.length - 2]
      const key = `${hub}/${lastPart}`
      if (pathToKeyIndex[key]) {
        return pathToKeyIndex[key]
      }
    }
  }

  // Try without role (neutral positions)
  const neutralKey = parts[parts.length - 1]
  if (pathToKeyIndex[neutralKey]) {
    return pathToKeyIndex[neutralKey]
  }

  return null
}

document.addEventListener("nav", async () => {
  const container = document.getElementById("move-cards")
  if (!container) return

  const graph = await fetchStateGraph()
  if (!graph) return

  // Get current page path and find corresponding position key
  const currentPath = window.location.pathname
  const urlPath = pathFromUrl(currentPath)
  const positionKey = findPositionKey(urlPath)

  // Find position data using the resolved key
  const positionData = positionKey ? graph.positions[positionKey] : null
  if (!positionData || !positionData.transitions || positionData.transitions.length === 0) {
    // Hide container if no moves available
    const containerParent = container.closest(".move-cards-container")
    if (containerParent) {
      ;(containerParent as HTMLElement).style.display = "none"
    }
    return
  }

  // Show container
  const containerParent = container.closest(".move-cards-container")
  if (containerParent) {
    ;(containerParent as HTMLElement).style.display = "block"
  }

  removeAllChildren(container)

  for (const transition of positionData.transitions) {
    const card = document.createElement("div")
    card.className = `move-card ${transition.isSubmission ? "submission" : ""}`

    // Flip coin for skill level (intermediate or advanced)
    const useAdvanced = Math.random() > 0.5
    const successRate = useAdvanced
      ? transition.successRate.advanced
      : transition.successRate.intermediate

    card.innerHTML = `
      <div class="move-card-technique">${transition.technique}</div>
      <div class="move-card-probability">${successRate}% success</div>
      <div class="probability-bar">
        <div class="probability-fill" style="width: ${successRate}%"></div>
      </div>
    `

    card.addEventListener("click", () => {
      executeTransition(transition, successRate, currentPath)
    })

    container.appendChild(card)
  }
})

/**
 * Convert a slug path to URL format (Title-Case-With-Hyphens)
 * e.g., "twister-control/truck" → "Twister-Control/Truck"
 */
function slugToUrlPath(slug: string): string {
  return slug
    .split("/")
    .map((part) =>
      part
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("-"),
    )
    .join("/")
}

/**
 * Extract role suffix from a target slug
 * e.g., "mount/top" → "top", "standing-position" → null
 */
function extractRole(target: string): string | null {
  const parts = target.split("/")
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1]
    if (lastPart === "top" || lastPart === "bottom") {
      return lastPart
    }
  }
  return null
}

function executeTransition(
  transition: {
    technique: string
    target: string
    targetPath?: string
    isSubmission?: boolean
    submissionSlug?: string
  },
  successRate: number,
  fromPath: string,
) {
  // Roll the dice
  const roll = Math.random() * 100
  const success = roll < successRate

  // Track journey
  addToJourney({
    slug: fromPath,
    name: transition.technique,
    type: transition.isSubmission ? "submission" : "transition",
    success,
  })

  if (success) {
    // Build target URL
    let targetUrl: string

    if (transition.isSubmission && transition.submissionSlug) {
      // Submissions go to the Submission page for Knowledge Test
      // e.g., /Submissions/Armbar
      const submissionPath = slugToUrlPath(transition.submissionSlug)
      targetUrl = `/Submissions/${submissionPath}`
    } else if (transition.targetPath) {
      // Use targetPath for the base path
      const basePath = slugToUrlPath(transition.targetPath)

      // Extract role from target (top/bottom) if present
      const role = extractRole(transition.target)

      if (role) {
        // Add role suffix: /Positions/Twister-Control/Truck/Top
        targetUrl = `/Positions/${basePath}/${role.charAt(0).toUpperCase() + role.slice(1)}`
      } else {
        // Neutral position or terminal state: /Positions/Standing-Position
        targetUrl = `/Positions/${basePath}`
      }
    } else {
      // Fallback: convert target slug directly
      const targetParts = transition.target.split("/")
      const formattedParts = targetParts.map((part) =>
        part
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join("-"),
      )
      targetUrl = `/Positions/${formattedParts.join("/")}`
    }

    // Navigate with success snackbar
    sessionStorage.setItem(
      "snackbar",
      JSON.stringify({
        type: "success",
        message: transition.isSubmission
          ? `Going for ${transition.technique}!`
          : `${transition.technique} successful!`,
        from: fromPath,
      }),
    )

    window.spaNavigate(new URL(targetUrl, window.location.toString()), false)
  } else {
    // Stay on page with failure snackbar
    const showSnackbar = (window as any).showSnackbar
    if (showSnackbar) {
      showSnackbar({
        type: "failure",
        message: `${transition.technique} defended!`,
      })
    }
  }
}

// Journey tracking in localStorage
interface JourneyStep {
  slug: string
  name: string
  type: "position" | "transition" | "submission"
  success?: boolean
}

function getJourney(): JourneyStep[] {
  try {
    return JSON.parse(localStorage.getItem("bjj-journey") || "[]")
  } catch {
    return []
  }
}

function addToJourney(step: JourneyStep) {
  const journey = getJourney()
  journey.push(step)
  localStorage.setItem("bjj-journey", JSON.stringify(journey))
}

function clearJourney() {
  localStorage.setItem("bjj-journey", "[]")
}

// Expose globally
;(window as any).clearJourney = clearJourney
;(window as any).getJourney = getJourney
