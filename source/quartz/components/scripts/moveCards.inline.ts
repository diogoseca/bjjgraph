// Move Cards - Display available moves on position pages
// Reads per-page graph data injected at build time (no runtime fetch)
import { removeAllChildren } from "./util"
import { loadSettings, saveSettings } from "./settings"
import type { GameMode } from "./settings"
import { findCard } from "./srs"
import {
  fetchExplorerTree,
  appendToRollHistory,
  syncRollToUrl,
  clearRollHistory,
} from "./explorerGraphExpand"

interface OpponentTransition {
  technique: string
  target: string
  targetPath?: string
  isSubmission: boolean
  attemptProbability: number
  successRate: number
  successOutcome?: string
  successOutcomePath?: string
}

interface PositionPageData {
  type: "position"
  name: string
  role?: string
  transitions: Array<{
    technique: string
    target: string
    targetPath?: string
    isSubmission: boolean
    successRate: number
  }>
  defenses: Array<{
    technique: string
    target: string
    targetPath?: string
    successRate: number
  }>
  opponentTransitions?: OpponentTransition[]
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

/** Get user-adjusted rates from localStorage */
function getVotes(): Record<string, Record<string, number>> {
  try {
    const raw = JSON.parse(localStorage.getItem("bjj-move-votes") || "{}")
    // Migrate old "up"/"down" format — clear it since we can't recover a rate
    for (const pos of Object.keys(raw)) {
      for (const tech of Object.keys(raw[pos])) {
        const v = raw[pos][tech]
        if (typeof v !== "number") delete raw[pos][tech]
      }
    }
    return raw
  } catch {
    return {}
  }
}

/** Save the user's adjusted rate for a technique */
function setVote(positionSlug: string, technique: string, adjustedRate: number, baseRate: number) {
  const votes = getVotes()
  if (!votes[positionSlug]) votes[positionSlug] = {}
  if (adjustedRate === baseRate) {
    delete votes[positionSlug][technique]
  } else {
    votes[positionSlug][technique] = Math.round(adjustedRate)
  }
  localStorage.setItem("bjj-move-votes", JSON.stringify(votes))
  import("./supabase").then((m) => m.syncAfterWrite()).catch(() => {})
}

function nudgeRate(current: number, direction: "up" | "down"): number {
  if (direction === "up") return Math.min(current + 1, 100)
  return Math.max(current - 1, 0)
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
  // Clear roll history if user navigated away from game flow (e.g., clicked explorer link)
  const path = window.location.pathname.toLowerCase()
  const inGameFlow =
    (path.includes("/positions/") && (path.endsWith("/top") || path.endsWith("/bottom"))) ||
    (path.includes("/transitions/") &&
      (path.endsWith("/attacker") || path.endsWith("/defender"))) ||
    (path.includes("/submissions/") &&
      (path.endsWith("/attacker") || path.endsWith("/defender"))) ||
    path.endsWith("/game-over")
  if (!inGameFlow) {
    clearRollHistory()
  }
  syncRollToUrl()

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
  const positionSlug = currentPath.toLowerCase()
  const votes = getVotes()
  const positionVotes = votes[positionSlug] || {}
  const rarityLabels = computeMoveRarity(positionData.transitions)

  removeAllChildren(container)

  let gameMode = loadSettings().gameMode

  // Game mode picker in header
  const modeLabel = document.getElementById("game-mode-label")
  const modePicker = document.getElementById("game-mode-picker")
  const modeDropdown = document.getElementById("game-mode-dropdown")

  function updateModeLabel() {
    if (!modeLabel) return
    modeLabel.textContent = `AI: ${gameMode}`
  }
  updateModeLabel()

  if (modePicker && modeDropdown) {
    // Mark active option
    const markActive = () => {
      modeDropdown.querySelectorAll(".game-mode-option").forEach((btn) => {
        btn.classList.toggle("active", (btn as HTMLElement).dataset.mode === gameMode)
      })
    }
    markActive()

    // Toggle dropdown on label click
    modeLabel?.addEventListener("click", (e) => {
      e.stopPropagation()
      modePicker.classList.toggle("open")
    })

    // Option clicks
    modeDropdown
      .querySelectorAll(".game-mode-option:not(.game-mode-option--locked)")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation()
          const mode = (btn as HTMLElement).dataset.mode as GameMode
          if (!mode) return
          gameMode = mode
          const settings = loadSettings()
          settings.gameMode = mode
          saveSettings(settings)
          updateModeLabel()
          markActive()
          modePicker.classList.remove("open")
          // Re-render cards with new mode
          window.spaNavigate(new URL(window.location.toString()), false)
        })
      })

    // Close dropdown when clicking outside
    const closeDropdown = () => modePicker.classList.remove("open")
    document.addEventListener("click", closeDropdown)
    window.addCleanup(() => document.removeEventListener("click", closeDropdown))
  }

  // Compute mastery modifier: +3% per mastered technique, cap +15%
  let masteredCount = 0
  for (const t of positionData.transitions) {
    const c = findCard(t.technique)
    if (c && c.repetitions >= 5 && c.easeFactor >= 2.5) masteredCount++
  }
  currentModifier = Math.min(masteredCount * 3, 15)

  // Show mastery modifier banner if active (only in game modes with dice)
  if (currentModifier > 0 && gameMode !== "off") {
    const banner = document.createElement("div")
    banner.className = "mastery-modifier-banner"
    banner.innerHTML = `<span class="mastery-modifier-icon">&#10022;</span> +${currentModifier}% mastery bonus <span class="mastery-modifier-detail">(${masteredCount} technique${masteredCount !== 1 ? "s" : ""} mastered)</span>`
    container.appendChild(banner)
  }

  positionData.transitions.forEach((transition, i) => {
    const card = document.createElement("div")

    // Check SRS status for mastery badges
    const srsCard = findCard(transition.technique)
    let srsClass = ""
    if (srsCard) {
      if (srsCard.repetitions >= 5 && srsCard.easeFactor >= 2.5) {
        srsClass = " mastered"
      } else if (srsCard.nextReview <= new Date().toISOString().slice(0, 10)) {
        srsClass = " srs-due"
      } else {
        srsClass = " srs-learning"
      }
    }
    card.className = `move-card${transition.isSubmission ? " submission" : ""}${srsClass}${gameMode === "off" ? " move-card--browse" : ""}`

    const baseRate = transition.successRate ?? 50
    const rarity = rarityLabels[i]
    const savedRate = positionVotes[transition.technique]
    const successRate = savedRate !== undefined ? savedRate : baseRate
    const nudge = successRate - baseRate

    const rarityBadge = rarity
      ? `<span class="move-card-badge move-card-badge--${rarity}">${rarity === "common" ? "Common Move" : "Rare Move"}</span>`
      : ""

    const masteryBadge =
      srsCard && srsCard.repetitions >= 5 && srsCard.easeFactor >= 2.5
        ? '<span class="move-card-badge move-card-badge--mastered">&#10022; Mastered</span>'
        : srsCard && srsCard.nextReview <= new Date().toISOString().slice(0, 10)
          ? '<span class="move-card-badge move-card-badge--review">Review</span>'
          : ""

    const techniquePath = transition.isSubmission ? "Submissions" : "Transitions"
    const techniqueUrl = `/${techniquePath}/${transition.targetPath ?? transition.target}/Attacker`

    // Show modifier on success rate if active
    const modifierHtml =
      currentModifier > 0
        ? ` <span class="vote-nudge positive">(+${currentModifier}% mastery)</span>`
        : ""

    card.setAttribute("tabindex", "0")
    card.setAttribute("role", "button")

    const showDiceUI = gameMode !== "off"

    card.innerHTML = `
      <div class="move-card-header">
        <a href="${techniqueUrl}" class="move-card-technique internal" data-no-navigate="true">${transition.technique}</a>
        ${rarityBadge}${masteryBadge}
      </div>
      <div class="move-card-probability">${successRate}% success${nudge !== 0 ? ` <span class="vote-nudge ${nudge > 0 ? "positive" : "negative"}">(${nudge > 0 ? "+" : ""}${nudge}%)</span>` : ""}${modifierHtml}</div>
      <div class="probability-bar">
        <div class="probability-fill" style="width: ${Math.min(successRate + currentModifier, 100)}%"></div>
      </div>
      ${
        showDiceUI
          ? `<div class="move-card-votes">
        <button class="vote-btn vote-up" aria-label="Upvote ${transition.technique}" title="Upvote">&#x25B2;</button>
        <button class="vote-btn vote-down" aria-label="Downvote ${transition.technique}" title="Downvote">&#x25BC;</button>
      </div>`
          : ""
      }
    `

    // Clicking the technique name navigates to Attacker page (stop card dice roll)
    const techniqueLink = card.querySelector(".move-card-technique") as HTMLAnchorElement
    if (techniqueLink) {
      techniqueLink.addEventListener("click", (e) => e.stopPropagation())
    }

    // Keyboard accessibility
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        if (gameMode === "off") {
          window.spaNavigate(new URL(techniqueUrl, window.location.toString()), false)
        } else {
          executeTransition(transition, successRate, currentPath, positionData)
        }
      }
    })

    // Vote button handlers (only in game modes with dice UI)
    if (showDiceUI) {
      const upBtn = card.querySelector(".vote-up") as HTMLButtonElement
      const downBtn = card.querySelector(".vote-down") as HTMLButtonElement

      let currentRate = successRate

      const updateVoteUI = (newRate: number) => {
        currentRate = newRate
        const newNudge = newRate - baseRate
        setVote(positionSlug, transition.technique, newRate, baseRate)

        // Update probability display with inline nudge
        const probEl = card.querySelector(".move-card-probability") as HTMLElement
        const nudgeHtml =
          newNudge !== 0
            ? ` <span class="vote-nudge ${newNudge > 0 ? "positive" : "negative"}">(${newNudge > 0 ? "+" : ""}${newNudge}%)</span>`
            : ""
        probEl.innerHTML = `${newRate}% success${nudgeHtml}`
        const fillEl = card.querySelector(".probability-fill") as HTMLElement
        fillEl.style.width = `${newRate}%`

        // Send PostHog event
        const posthog = (window as any).posthog
        if (posthog?.capture) {
          posthog.capture("move_vote", {
            technique: transition.technique,
            base_rate: baseRate,
            adjusted_rate: newRate,
            position: positionSlug,
          })
        }
      }

      upBtn.addEventListener("click", (e) => {
        e.stopPropagation()
        updateVoteUI(nudgeRate(currentRate, "up"))
      })

      downBtn.addEventListener("click", (e) => {
        e.stopPropagation()
        updateVoteUI(nudgeRate(currentRate, "down"))
      })
    }

    card.addEventListener("click", () => {
      if (gameMode === "off") {
        window.spaNavigate(new URL(techniqueUrl, window.location.toString()), false)
      } else {
        executeTransition(transition, successRate, currentPath, positionData)
      }
    })

    container.appendChild(card)
  })

  // Cleanup on navigation
  window.addCleanup(() => {
    removeOpponentOverlay()
  })
})

// Mastery modifier: position-only success rate boost from mastered techniques
let currentModifier = 0

// Opponent turn system
function triggerOpponentTurn(positionData: PositionPageData, currentPath: string) {
  const oppMoves = positionData.opponentTransitions
  if (!oppMoves || oppMoves.length === 0) {
    const showSnackbar = (window as any).showSnackbar
    if (showSnackbar) {
      showSnackbar({ type: "failure", message: "Move defended! Your turn again." })
    }
    return
  }

  // Weighted random select by attemptProbability
  const totalWeight = oppMoves.reduce((s, m) => s + (m.attemptProbability || 1), 0)
  let roll = Math.random() * totalWeight
  let selectedMove = oppMoves[0]
  for (const move of oppMoves) {
    roll -= move.attemptProbability || 1
    if (roll <= 0) {
      selectedMove = move
      break
    }
  }

  // Dice roll for opponent
  const oppSuccess = Math.random() * 100 < selectedMove.successRate

  showOpponentOverlay(selectedMove, oppSuccess, positionData, currentPath)
}

function showOpponentOverlay(
  move: OpponentTransition,
  success: boolean,
  positionData: PositionPageData,
  currentPath: string,
) {
  removeOpponentOverlay()

  const overlay = document.createElement("div")
  overlay.id = "opponent-overlay"
  overlay.className = "opponent-overlay"

  const panel = document.createElement("div")
  panel.className = "opponent-panel"
  panel.innerHTML = `
    <div class="opponent-title">Opponent's Turn</div>
    <div class="opponent-action">Opponent attempts <strong>${move.technique}</strong>...</div>
    <div class="opponent-result" style="display: none"></div>
    <div class="opponent-progress"><div class="opponent-progress-fill"></div></div>
  `
  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  // Show result after 1.5s
  setTimeout(() => {
    const resultEl = panel.querySelector(".opponent-result") as HTMLElement
    if (!resultEl) return

    if (success) {
      resultEl.textContent =
        move.isSubmission || move.successOutcome === "game-over"
          ? `${move.technique} locked in!`
          : `${move.technique} succeeds!`
      resultEl.classList.add("opponent-success")
    } else {
      resultEl.textContent = "You defended!"
      resultEl.classList.add("opponent-defended")
    }
    resultEl.style.display = "block"

    // Auto-dismiss after 2s more
    setTimeout(() => {
      removeOpponentOverlay()

      // Record in journey
      addToJourney({
        slug: currentPath,
        name: move.technique,
        type: move.isSubmission ? "submission" : "transition",
        success: !success, // from player perspective: opponent success = player failure
        action: "opponent-turn",
      })

      if (success) {
        // Navigate to outcome position, flipping role
        if (move.isSubmission) {
          // Opponent submitted us — go to game-over
          const journey = getJourney()
          sessionStorage.setItem(
            "snackbar",
            JSON.stringify({ type: "failure", message: `Caught by ${move.technique}!` }),
          )
          // Don't set victory data — this is a defeat
          window.spaNavigate(new URL("/Game-Over", window.location.toString()), false)
        } else if (move.successOutcome) {
          // Navigate to the outcome position with flipped role
          const outcomeParts = move.successOutcome.split("/")
          const outcomePos = outcomeParts[0]
          const outcomeRole = outcomeParts.length > 1 ? outcomeParts[1] : null

          // Flip the role: if opponent lands at half-guard/bottom, we are at half-guard/top
          let flippedRole = ""
          if (outcomeRole === "top") flippedRole = "Bottom"
          else if (outcomeRole === "bottom") flippedRole = "Top"

          const basePath = move.successOutcomePath || outcomePos
          let targetUrl: string
          if (flippedRole) {
            targetUrl = `/Positions/${basePath}/${flippedRole}`
          } else {
            targetUrl = `/Positions/${basePath}`
          }

          sessionStorage.setItem(
            "snackbar",
            JSON.stringify({
              type: "failure",
              message:
                move.successOutcome === "game-over"
                  ? `Submitted by ${move.technique}!`
                  : `Opponent countered with ${move.technique}!`,
            }),
          )

          window.spaNavigate(new URL(targetUrl, window.location.toString()), false)
        }
      } else {
        // Opponent failed
        const showSnackbar = (window as any).showSnackbar
        if (showSnackbar) {
          showSnackbar({ type: "success", message: "You defended! Your turn again." })
        }
      }
    }, 2000)
  }, 1500)
}

function removeOpponentOverlay() {
  const existing = document.getElementById("opponent-overlay")
  if (existing) existing.remove()
}

async function executeTransition(
  transition: {
    technique: string
    target: string
    targetPath?: string
    isSubmission?: boolean
  },
  successRate: number,
  fromPath: string,
  positionData?: PositionPageData,
) {
  // Roll the dice (apply mastery modifier from position page)
  const roll = Math.random() * 100
  const effectiveRate = Math.min(successRate + currentModifier, 100)
  const success = roll < effectiveRate

  // Track journey
  addToJourney({
    slug: fromPath,
    name: transition.technique,
    type: transition.isSubmission ? "submission" : "transition",
    success,
    action: "dice-roll",
  })

  try {
    const data = await fetchExplorerTree()
    const tech = data.techniques[transition.target]
    if (tech?.id) appendToRollHistory(tech.id)
  } catch {
    // network failure — skip roll history, continue navigation
  }

  if (success) {
    // Build target URL
    let targetUrl: string

    if (transition.isSubmission) {
      targetUrl = `/Submissions/${transition.targetPath ?? transition.target}/Attacker`
    } else {
      targetUrl = `/Transitions/${transition.targetPath ?? transition.target}/Attacker`
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

    // Trigger opponent turn if game mode supports it
    if (positionData) {
      const settings = loadSettings()
      if (settings.gameMode === "normal") {
        triggerOpponentTurn(positionData, fromPath)
      }
    }
  }
}

// Journey tracking in localStorage
interface JourneyStep {
  slug: string
  name: string
  type: "position" | "transition" | "submission"
  success?: boolean
  action?: "dice-roll" | "flashcard" | "opponent-turn"
  rating?: "again" | "hard" | "easy"
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

// Common Mistakes Accordion
document.addEventListener("nav", () => {
  const section = document.getElementById("common-mistakes")
  if (!section) return

  const headings = section.querySelectorAll("h3")
  headings.forEach((heading) => {
    // Collect sibling elements until next h3 or end of section
    const bodyElements: Element[] = []
    let sibling = heading.nextElementSibling
    while (sibling && sibling.tagName !== "H3") {
      bodyElements.push(sibling)
      sibling = sibling.nextElementSibling
    }

    if (bodyElements.length === 0) return

    // Wrap in a collapsible body div
    const bodyDiv = document.createElement("div")
    bodyDiv.className = "mistake-body"
    heading.after(bodyDiv)
    bodyElements.forEach((el) => bodyDiv.appendChild(el))

    // Style heading as toggle
    heading.classList.add("mistake-heading")
    heading.addEventListener("click", () => {
      heading.classList.toggle("open")
      bodyDiv.classList.toggle("open")
    })
  })
})
