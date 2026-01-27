// Victory Display - Game-over page with performance report
// Journey data stored in localStorage (future: auth + server-side persistence)

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

interface TechniqueRecord {
  name: string
  attempts: number
  successes: number
}

function createConfetti(container: HTMLElement) {
  const colors = ["#2e7d32", "#4caf50", "#81c784", "#ffd700", "#ffeb3b"]

  for (let i = 0; i < 50; i++) {
    const piece = document.createElement("div")
    piece.className = "confetti-piece"
    piece.style.cssText = `
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
    container.appendChild(piece)
  }

  setTimeout(() => {
    container.innerHTML = ""
  }, 4000)
}

function hideAllContent() {
  const article = document.querySelector("article")
  if (article) {
    article.style.display = "none"
  }
}

/**
 * Analyze journey steps to produce strengths and weaknesses.
 * Groups techniques by name, calculates success rate, then splits
 * into "landed consistently" vs "needs more drilling".
 */
function analyzePerformance(journey: JourneyStep[]): {
  strengths: TechniqueRecord[]
  weaknesses: TechniqueRecord[]
} {
  const techniques = new Map<string, TechniqueRecord>()

  for (const step of journey) {
    if (step.success === undefined) continue

    let record = techniques.get(step.name)
    if (!record) {
      record = { name: step.name, attempts: 0, successes: 0 }
      techniques.set(step.name, record)
    }

    record.attempts++
    if (step.success) record.successes++
  }

  const strengths: TechniqueRecord[] = []
  const weaknesses: TechniqueRecord[] = []

  for (const record of techniques.values()) {
    const rate = record.successes / record.attempts
    if (rate >= 0.5) {
      strengths.push(record)
    } else {
      weaknesses.push(record)
    }
  }

  // Sort strengths by success rate descending, weaknesses by attempts descending
  strengths.sort((a, b) => b.successes / b.attempts - a.successes / a.attempts)
  weaknesses.sort((a, b) => b.attempts - a.attempts)

  return { strengths, weaknesses }
}

function renderReport(journey: JourneyStep[]) {
  const reportEl = document.getElementById("performance-report")
  const strengthsList = document.getElementById("report-strengths")
  const weaknessesList = document.getElementById("report-weaknesses")

  if (!reportEl || !strengthsList || !weaknessesList) return

  const { strengths, weaknesses } = analyzePerformance(journey)

  // Only show report if there's meaningful data (at least 2 technique attempts)
  const totalAttempts = journey.filter((s) => s.success !== undefined).length
  if (totalAttempts < 2) return

  for (const tech of strengths) {
    const li = document.createElement("li")
    li.className = "report-item strength"
    const pct = Math.round((tech.successes / tech.attempts) * 100)
    li.innerHTML = `<span class="report-technique">${tech.name}</span><span class="report-rate">${pct}%</span>`
    strengthsList.appendChild(li)
  }

  for (const tech of weaknesses) {
    const li = document.createElement("li")
    li.className = "report-item weakness"
    const pct = Math.round((tech.successes / tech.attempts) * 100)
    li.innerHTML = `<span class="report-technique">${tech.name}</span><span class="report-rate">${pct}%</span>`
    weaknessesList.appendChild(li)
  }

  // Show "Clean sheet" or "All defended" if one side is empty
  if (strengths.length === 0) {
    const li = document.createElement("li")
    li.className = "report-item empty"
    li.textContent = "Keep drilling!"
    strengthsList.appendChild(li)
  }

  if (weaknesses.length === 0) {
    const li = document.createElement("li")
    li.className = "report-item empty"
    li.textContent = "Clean sheet"
    weaknessesList.appendChild(li)
  }

  reportEl.style.display = "block"
}

// Uses build-time injected window.__rollPositions (no runtime fetch needed)
function navigateToRandomPosition() {
  const positions = (window as any).__rollPositions as Array<{ s: string; n: string }> | undefined
  if (!positions || positions.length === 0) {
    window.spaNavigate(new URL("/", window.location.toString()), false)
    return
  }

  const position = positions[Math.floor(Math.random() * positions.length)]

  sessionStorage.setItem(
    "snackbar",
    JSON.stringify({ type: "info", message: `Roll started in ${position.n}` }),
  )

  window.spaNavigate(new URL(`/${position.s}`, window.location.toString()), false)
}

function handleRollAgain() {
  localStorage.setItem("bjj-journey", "[]")
  sessionStorage.removeItem("victory-data")
  navigateToRandomPosition()
}

function handleStartRoll() {
  localStorage.setItem("bjj-journey", "[]")
  sessionStorage.removeItem("victory-data")
  navigateToRandomPosition()
}

document.addEventListener("nav", () => {
  const victoryDisplay = document.getElementById("victory-display")
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

  if (!victoryContent || !victoryFallback || !statMoves || !statSuccesses || !statFailures || !journeyPath) {
    return
  }

  const victoryDataRaw = sessionStorage.getItem("victory-data")

  if (victoryDataRaw) {
    try {
      const victoryData: VictoryData = JSON.parse(victoryDataRaw)
      const journey = victoryData.journey || []

      const totalMoves = journey.length
      const successes = journey.filter((step) => step.success === true).length
      const failures = journey.filter((step) => step.success === false).length

      statMoves.textContent = String(totalMoves)
      statSuccesses.textContent = String(successes)
      statFailures.textContent = String(failures)

      if (victoryTitle && victoryData.submissionName) {
        victoryTitle.textContent = `Victory by ${victoryData.submissionName}!`
      }

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

      // Performance report
      renderReport(journey)

      // Journey path
      journeyPath.innerHTML = ""

      const meaningfulSteps = journey.filter(
        (step, idx) => idx === 0 || step.type === "transition" || step.type === "submission",
      )

      meaningfulSteps.forEach((step, idx) => {
        const stepEl = document.createElement("span")
        stepEl.className = `journey-step ${step.type}`

        if (step.type !== "position" && step.success !== undefined) {
          stepEl.classList.add(step.success ? "success" : "failure")
        }

        stepEl.textContent = step.name
        journeyPath.appendChild(stepEl)

        if (idx < meaningfulSteps.length - 1) {
          const arrow = document.createElement("span")
          arrow.className = "journey-arrow"
          arrow.textContent = " \u2192 "
          journeyPath.appendChild(arrow)
        }
      })

      victoryContent.style.display = "block"
      victoryFallback.style.display = "none"
      hideAllContent()

      if (confettiContainer) {
        createConfetti(confettiContainer)
      }

      sessionStorage.removeItem("victory-data")
    } catch {
      victoryContent.style.display = "none"
      victoryFallback.style.display = "block"
      hideAllContent()
    }
  } else {
    victoryContent.style.display = "none"
    victoryFallback.style.display = "block"
    hideAllContent()
  }

  if (rollAgainBtn) {
    rollAgainBtn.addEventListener("click", handleRollAgain)
    window.addCleanup(() => rollAgainBtn.removeEventListener("click", handleRollAgain))
  }

  if (startRollBtn) {
    startRollBtn.addEventListener("click", handleStartRoll)
    window.addCleanup(() => startRollBtn.removeEventListener("click", handleStartRoll))
  }
})
