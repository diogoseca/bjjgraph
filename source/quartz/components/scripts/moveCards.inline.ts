// Move Cards - Display available moves on position pages
// Reads per-page graph data injected at build time (no runtime fetch)
import { removeAllChildren } from "./util"

interface PositionPageData {
  type: "position"
  name: string
  transitions: Array<{
    technique: string
    target: string
    targetPath?: string
    isSubmission: boolean
    submissionSlug?: string
    successRate: { intermediate: number; advanced: number }
  }>
  defenses: Array<{
    technique: string
    target: string
    targetPath?: string
    successRate: number
  }>
}

function getPageData(): PositionPageData | null {
  const el = document.getElementById("page-graph-data")
  if (!el?.textContent) return null
  try {
    const data = JSON.parse(el.textContent)
    return data.type === "position" ? data : null
  } catch {
    return null
  }
}

document.addEventListener("nav", () => {
  const container = document.getElementById("move-cards")
  if (!container) return

  const positionData = getPageData()
  if (!positionData || !positionData.transitions || positionData.transitions.length === 0) {
    const containerParent = container.closest(".move-cards-container")
    if (containerParent) {
      ;(containerParent as HTMLElement).style.display = "none"
    }
    return
  }

  const containerParent = container.closest(".move-cards-container")
  if (containerParent) {
    ;(containerParent as HTMLElement).style.display = "block"
  }

  const currentPath = window.location.pathname

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
    action: "dice-roll",
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
  action?: "dice-roll" | "flashcard"
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
