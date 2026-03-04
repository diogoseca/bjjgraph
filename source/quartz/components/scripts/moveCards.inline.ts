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
    successRate: number
  }>
  defenses: Array<{
    technique: string
    target: string
    targetPath?: string
    successRate: number
  }>
}

/**
 * Compute move rarity labels using adjusted standardized residuals.
 *
 * Compares each move's attempt probability (successRate) against a uniform
 * baseline (1/k), using the chi-square adjusted standardized residual:
 *
 *   d = (observed - expected) / sqrt(expected * (1 - expected / total))
 *
 * where expected = total/k and total = sum of all rates.
 * |d| > 2 is the standard threshold for significance.
 *
 * This naturally accounts for probability dilution as more moves are added:
 * with 3 moves you need a bigger gap than with 10 to be flagged.
 */
function computeMoveRarity(
  transitions: Array<{ successRate: number }>,
): Array<"common" | "rare" | null> {
  const k = transitions.length
  if (k < 3) return transitions.map(() => null) // need at least 3 to compare

  const total = transitions.reduce((sum, t) => sum + (t.successRate ?? 0), 0)
  if (total === 0) return transitions.map(() => null)

  const expected = total / k
  const denominator = Math.sqrt(expected * (1 - expected / total))
  if (denominator === 0) return transitions.map(() => null)

  return transitions.map((t) => {
    const observed = t.successRate ?? 0
    const d = (observed - expected) / denominator
    if (d > 2) return "common"
    if (d < -2) return "rare"
    return null
  })
}

/** Get vote state from localStorage */
function getVotes(): Record<string, Record<string, "up" | "down">> {
  try {
    return JSON.parse(localStorage.getItem("bjj-move-votes") || "{}")
  } catch {
    return {}
  }
}

/** Save a vote */
function setVote(positionSlug: string, technique: string, vote: "up" | "down" | null) {
  const votes = getVotes()
  if (!votes[positionSlug]) votes[positionSlug] = {}
  if (vote === null) {
    delete votes[positionSlug][technique]
  } else {
    votes[positionSlug][technique] = vote
  }
  localStorage.setItem("bjj-move-votes", JSON.stringify(votes))
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
  const positionSlug = currentPath
  const votes = getVotes()
  const positionVotes = votes[positionSlug] || {}
  const rarityLabels = computeMoveRarity(positionData.transitions)

  removeAllChildren(container)

  positionData.transitions.forEach((transition, i) => {
    const card = document.createElement("div")
    card.className = `move-card ${transition.isSubmission ? "submission" : ""}`

    const successRate = transition.successRate ?? 50
    const rarity = rarityLabels[i]
    const currentVote = positionVotes[transition.technique] || null

    const rarityBadge = rarity
      ? `<span class="move-card-badge move-card-badge--${rarity}">${rarity === "common" ? "Common Move" : "Rare Move"}</span>`
      : ""

    card.innerHTML = `
      <div class="move-card-header">
        <div class="move-card-technique">${transition.technique}</div>
        ${rarityBadge}
      </div>
      <div class="move-card-probability">${successRate}% success</div>
      <div class="probability-bar">
        <div class="probability-fill" style="width: ${successRate}%"></div>
      </div>
      <div class="move-card-votes">
        <button class="vote-btn vote-up ${currentVote === "up" ? "active" : ""}" aria-label="Upvote ${transition.technique}" title="Upvote">&#x25B2;</button>
        <button class="vote-btn vote-down ${currentVote === "down" ? "active" : ""}" aria-label="Downvote ${transition.technique}" title="Downvote">&#x25BC;</button>
      </div>
    `

    // Vote button handlers (stop propagation so card click doesn't fire)
    const upBtn = card.querySelector(".vote-up") as HTMLButtonElement
    const downBtn = card.querySelector(".vote-down") as HTMLButtonElement

    upBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      const newVote = currentVote === "up" ? null : "up"
      setVote(positionSlug, transition.technique, newVote)
      upBtn.classList.toggle("active", newVote === "up")
      downBtn.classList.remove("active")
    })

    downBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      const newVote = currentVote === "down" ? null : "down"
      setVote(positionSlug, transition.technique, newVote)
      downBtn.classList.toggle("active", newVote === "down")
      upBtn.classList.remove("active")
    })

    card.addEventListener("click", () => {
      executeTransition(transition, successRate, currentPath)
    })

    container.appendChild(card)
  })
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
