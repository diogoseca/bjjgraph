// Victory Display - Shows journey stats and celebration on Won by Submission page

interface JourneyStep {
  slug: string
  name: string
  type: "position" | "transition" | "submission"
  success?: boolean
}

interface VictoryData {
  submissionName: string
  journey: JourneyStep[]
}

// Simple confetti animation using CSS
function createConfetti(container: HTMLElement) {
  const colors = ["#2e7d32", "#4caf50", "#81c784", "#ffd700", "#ffeb3b"]
  const confettiCount = 50

  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement("div")
    confetti.className = "confetti-piece"
    confetti.style.cssText = `
      position: absolute;
      width: ${Math.random() * 10 + 5}px;
      height: ${Math.random() * 10 + 5}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${Math.random() * 100}%;
      top: -20px;
      opacity: ${Math.random() * 0.5 + 0.5};
      border-radius: ${Math.random() > 0.5 ? "50%" : "0"};
      animation: confetti-fall ${Math.random() * 2 + 2}s ease-out forwards;
      animation-delay: ${Math.random() * 0.5}s;
    `
    container.appendChild(confetti)
  }

  // Clean up confetti after animation
  setTimeout(() => {
    container.innerHTML = ""
  }, 4000)
}

// Hide ALL content sections - we only want the victory UI
function hideAllContent() {
  // Hide the entire article content
  const article = document.querySelector("article")
  if (article) {
    article.style.display = "none"
  }

  // Also hide any remaining sections by ID just in case
  const sectionsToHide = [
    "overview",
    "state-invariants",
    "prerequisites",
    "key-principles",
    "offensive-transitions",
    "defensive-responses",
    "counter-transitions",
    "decision-tree",
    "common-mistakes",
    "training-drills",
    "optimal-submission-paths",
    "position-metrics",
    "related-content",
  ]

  sectionsToHide.forEach((id) => {
    const section = document.getElementById(id)
    if (section) {
      section.style.display = "none"
    }
  })
}


// Handle Roll Again - clear journey and navigate home to roll
async function handleRollAgain() {
  // Clear journey data
  localStorage.setItem("bjj-journey", "[]")
  sessionStorage.removeItem("victory-data")

  // Fetch state graph and pick random position
  const baseUrl = document.documentElement.dataset.baseUrl ?? ""

  try {
    const response = await fetch(`${baseUrl}/static/stateGraph.json`)
    const stateGraph = await response.json()

    // Get all position pages with roles
    const rolePages = Object.keys(stateGraph.positions).filter(
      (slug: string) => slug.includes("/top") || slug.includes("/bottom"),
    )

    if (rolePages.length === 0) {
      window.spaNavigate(new URL("/", window.location.toString()), false)
      return
    }

    const randomSlug = rolePages[Math.floor(Math.random() * rolePages.length)]
    const positionData = stateGraph.positions[randomSlug]
    const positionName = positionData?.name || "Unknown Position"

    // Set snackbar for arrival
    sessionStorage.setItem(
      "snackbar",
      JSON.stringify({
        type: "info",
        message: `Roll started in ${positionName}`,
      }),
    )

    // Build URL
    let targetUrl: string
    if (positionData?.path) {
      const urlPath = positionData.path.replace(/\s+/g, "-")
      targetUrl = `/Positions/${urlPath}`
    } else {
      const pathParts = randomSlug.split("/")
      const formattedParts = pathParts.map((part: string) =>
        part
          .split("-")
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join("-"),
      )
      targetUrl = `/Positions/${formattedParts.join("/")}`
    }

    window.spaNavigate(new URL(targetUrl, window.location.toString()), false)
  } catch {
    // Fallback to homepage
    window.spaNavigate(new URL("/", window.location.toString()), false)
  }
}

// Navigate to homepage for Start Rolling button
function handleStartRoll() {
  localStorage.setItem("bjj-journey", "[]")
  sessionStorage.removeItem("victory-data")
  handleRollAgain()
}

document.addEventListener("nav", () => {
  console.log("[VictoryDisplay] Nav event fired")
  const victoryDisplay = document.getElementById("victory-display")
  console.log("[VictoryDisplay] victoryDisplay element:", victoryDisplay)
  if (!victoryDisplay) return

  const victoryContent = document.getElementById("victory-content")
  const victoryFallback = document.getElementById("victory-fallback")
  const confettiContainer = document.getElementById("confetti-container")
  const victoryTitle = document.getElementById("victory-title")
  const victorySubtitle = document.getElementById("victory-subtitle")
  const statMoves = document.getElementById("stat-moves")
  const statSuccesses = document.getElementById("stat-successes")
  const statFailures = document.getElementById("stat-failures")
  const journeyPath = document.getElementById("journey-path")
  const rollAgainBtn = document.getElementById("roll-again-btn")
  const startRollBtn = document.getElementById("start-roll-btn")

  console.log("[VictoryDisplay] Elements found:", {
    victoryContent: !!victoryContent,
    victoryFallback: !!victoryFallback,
    statMoves: !!statMoves,
    statSuccesses: !!statSuccesses,
    statFailures: !!statFailures,
    journeyPath: !!journeyPath,
  })

  if (
    !victoryContent ||
    !victoryFallback ||
    !statMoves ||
    !statSuccesses ||
    !statFailures ||
    !journeyPath
  ) {
    console.log("[VictoryDisplay] Missing required elements, exiting")
    return
  }

  // Check for victory data from sessionStorage
  const victoryDataRaw = sessionStorage.getItem("victory-data")
  console.log("[VictoryDisplay] Victory data raw:", victoryDataRaw)

  if (victoryDataRaw) {
    try {
      const victoryData: VictoryData = JSON.parse(victoryDataRaw)
      const journey = victoryData.journey || []

      // Calculate stats
      const totalMoves = journey.length
      const successes = journey.filter((step) => step.success === true).length
      const failures = journey.filter((step) => step.success === false).length

      // Update stats
      statMoves.textContent = String(totalMoves)
      statSuccesses.textContent = String(successes)
      statFailures.textContent = String(failures)

      // Update title with submission name
      if (victoryTitle && victoryData.submissionName) {
        victoryTitle.textContent = `Victory by ${victoryData.submissionName}!`
      }

      // Add subtitle
      if (victorySubtitle) {
        if (totalMoves === 1) {
          victorySubtitle.textContent = "Lightning fast submission!"
        } else if (failures === 0) {
          victorySubtitle.textContent = "Flawless victory - perfect technique!"
        } else if (successes > failures) {
          victorySubtitle.textContent = "Great work! You outmaneuvered your opponent."
        } else {
          victorySubtitle.textContent = "Hard-fought victory!"
        }
      }

      // Build journey path display
      journeyPath.innerHTML = ""

      // Filter to show meaningful steps (first position + transitions/submissions)
      const meaningfulSteps = journey.filter(
        (step, index) => index === 0 || step.type === "transition" || step.type === "submission",
      )

      meaningfulSteps.forEach((step, index) => {
        const stepEl = document.createElement("span")
        stepEl.className = `journey-step ${step.type}`

        // Add success/failure indicator for transitions/submissions
        if (step.type !== "position" && step.success !== undefined) {
          stepEl.classList.add(step.success ? "success" : "failure")
        }

        stepEl.textContent = step.name

        journeyPath.appendChild(stepEl)

        // Add arrow between steps
        if (index < meaningfulSteps.length - 1) {
          const arrow = document.createElement("span")
          arrow.className = "journey-arrow"
          arrow.textContent = " \u2192 "
          journeyPath.appendChild(arrow)
        }
      })

      // Show victory content, hide fallback
      victoryContent.style.display = "block"
      victoryFallback.style.display = "none"

      // Hide all static content - only show victory UI
      hideAllContent()

      // Trigger confetti
      if (confettiContainer) {
        createConfetti(confettiContainer)
      }

      // Clear victory data after displaying (so refresh shows fallback)
      sessionStorage.removeItem("victory-data")
    } catch {
      // Invalid data, show fallback
      victoryContent.style.display = "none"
      victoryFallback.style.display = "block"
      hideAllContent()
    }
  } else {
    // No victory data - show fallback for direct navigation
    console.log("[VictoryDisplay] No victory data, showing fallback")
    victoryContent.style.display = "none"
    victoryFallback.style.display = "block"
    console.log("[VictoryDisplay] Fallback display set to:", victoryFallback.style.display)
    // Hide all static content - only show the Roll button
    hideAllContent()
  }

  // Attach event handlers
  if (rollAgainBtn) {
    rollAgainBtn.addEventListener("click", handleRollAgain)
    window.addCleanup(() => rollAgainBtn.removeEventListener("click", handleRollAgain))
  }

  if (startRollBtn) {
    startRollBtn.addEventListener("click", handleStartRoll)
    window.addCleanup(() => startRollBtn.removeEventListener("click", handleStartRoll))
  }
})
