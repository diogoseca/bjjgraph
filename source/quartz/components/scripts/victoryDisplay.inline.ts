// Victory Display - Game-over page with performance report
// Journey data stored in localStorage (future: auth + server-side persistence)
import { getRollParam, decodeRollUrl, clearRollUrl, clearRollHistory } from "./explorerGraphExpand"
import { loadSettings } from "./settings"
import { safeSetItem } from "./util"
import { playGameSound } from "./gameAudio"

interface JourneyStep {
  slug: string
  name: string
  type: "position" | "transition" | "submission"
  success?: boolean
  action?: "dice-roll" | "flashcard" | "opponent-turn"
  rating?: "again" | "hard" | "easy"
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

interface TechniqueLifetime {
  diceAttempts: number
  diceSuccesses: number
  flashcardAttempts: number
  flashcardCorrect: number
}

interface LifetimeStats {
  totalRolls: number
  totalVictories: number
  totalMoves: number
  diceRolls: { total: number; successes: number }
  flashcards: { total: number; correct: number }
  opponentTurns: { total: number; defended: number }
  techniques: Record<string, TechniqueLifetime>
}

const LIFETIME_KEY = "bjj-lifetime-stats"

function zeroedLifetimeStats(): LifetimeStats {
  return {
    totalRolls: 0,
    totalVictories: 0,
    totalMoves: 0,
    diceRolls: { total: 0, successes: 0 },
    flashcards: { total: 0, correct: 0 },
    opponentTurns: { total: 0, defended: 0 },
    techniques: {},
  }
}

// Coerce to a finite number, else 0.
function num0(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0
}

function loadLifetimeStats(): LifetimeStats {
  const base = zeroedLifetimeStats()
  try {
    const raw = localStorage.getItem(LIFETIME_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      if (p && typeof p === "object") {
        base.totalRolls = num0(p.totalRolls)
        base.totalVictories = num0(p.totalVictories)
        base.totalMoves = num0(p.totalMoves)
        if (p.diceRolls && typeof p.diceRolls === "object") {
          base.diceRolls = {
            total: num0(p.diceRolls.total),
            successes: num0(p.diceRolls.successes),
          }
        }
        if (p.flashcards && typeof p.flashcards === "object") {
          base.flashcards = { total: num0(p.flashcards.total), correct: num0(p.flashcards.correct) }
        }
        if (p.opponentTurns && typeof p.opponentTurns === "object") {
          base.opponentTurns = {
            total: num0(p.opponentTurns.total),
            defended: num0(p.opponentTurns.defended),
          }
        }
        if (p.techniques && typeof p.techniques === "object" && !Array.isArray(p.techniques)) {
          base.techniques = p.techniques as Record<string, TechniqueLifetime>
        }
      }
    }
  } catch {
    // corrupt data, start fresh
  }
  return base
}

function saveLifetimeStats(stats: LifetimeStats) {
  safeSetItem(LIFETIME_KEY, JSON.stringify(stats))
  import("./supabase").then((m) => m.syncAfterWrite()).catch(() => {})
}

/** Backward-compat: old journey data lacks action field */
function inferAction(step: JourneyStep): "dice-roll" | "flashcard" | "opponent-turn" {
  return step.action ?? "dice-roll"
}

/** Merge current roll into lifetime stats (called once per victory) */
function accumulateStats(journey: JourneyStep[]): LifetimeStats {
  const stats = loadLifetimeStats()

  stats.totalRolls++
  stats.totalVictories++
  stats.totalMoves += journey.length

  for (const step of journey) {
    if (step.success === undefined) continue

    const action = inferAction(step)

    if (action === "opponent-turn") {
      if (!stats.opponentTurns) stats.opponentTurns = { total: 0, defended: 0 }
      stats.opponentTurns.total++
      if (step.success) stats.opponentTurns.defended++
    } else if (action === "dice-roll") {
      stats.diceRolls.total++
      if (step.success) stats.diceRolls.successes++
    } else {
      stats.flashcards.total++
      if (step.success) stats.flashcards.correct++
    }

    // Per-technique tracking
    if (!stats.techniques[step.name]) {
      stats.techniques[step.name] = {
        diceAttempts: 0,
        diceSuccesses: 0,
        flashcardAttempts: 0,
        flashcardCorrect: 0,
      }
    }
    const tech = stats.techniques[step.name]
    if (action === "dice-roll") {
      tech.diceAttempts++
      if (step.success) tech.diceSuccesses++
    } else if (action === "flashcard") {
      tech.flashcardAttempts++
      if (step.success) tech.flashcardCorrect++
    }
    // opponent-turn is tracked at stats.opponentTurns level, skip per-technique
  }

  saveLifetimeStats(stats)
  return stats
}

function createCosmicBurst(container: HTMLElement) {
  container.replaceChildren()
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

  const colors = ["#d9fbff", "#8eeeff", "#80aaff", "#f5f3d0"]
  const particleCount = 44

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement("span")
    const angle = (360 / particleCount) * i + (Math.random() - 0.5) * 12
    particle.className =
      i % 5 === 0 ? "victory-star victory-star--spark" : "victory-star victory-star--streak"
    particle.style.setProperty("--star-angle", `${angle}deg`)
    particle.style.setProperty("--star-distance", `${120 + Math.random() * 190}px`)
    particle.style.setProperty("--star-delay", `${Math.random() * 0.28}s`)
    particle.style.setProperty("--star-duration", `${0.85 + Math.random() * 0.7}s`)
    particle.style.setProperty("--star-color", colors[Math.floor(Math.random() * colors.length)])
    container.appendChild(particle)
  }

  setTimeout(() => container.replaceChildren(), 2400)
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

function renderReportList(
  list: HTMLElement,
  records: TechniqueRecord[],
  emptyMessage: string,
  cssClass: string,
) {
  for (const tech of records) {
    const li = document.createElement("li")
    li.className = `report-item ${cssClass}`
    const pct = Math.round((tech.successes / tech.attempts) * 100)
    const nameEl = document.createElement("span")
    nameEl.className = "report-technique"
    nameEl.textContent = tech.name
    const rateEl = document.createElement("span")
    rateEl.className = "report-rate"
    rateEl.textContent = `${pct}%`
    li.appendChild(nameEl)
    li.appendChild(rateEl)
    list.appendChild(li)
  }
  if (records.length === 0) {
    const li = document.createElement("li")
    li.className = "report-item empty"
    li.textContent = emptyMessage
    list.appendChild(li)
  }
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

  renderReportList(strengthsList, strengths, "Keep drilling!", "strength")
  renderReportList(weaknessesList, weaknesses, "Clean sheet", "weakness")

  reportEl.style.display = "block"
}

function renderLifetimeStats(stats: LifetimeStats, prefix: string) {
  const container = document.getElementById(`${prefix}lifetime-stats`)
  if (!container) return

  if (stats.totalRolls === 0) {
    container.style.display = "none"
    return
  }

  container.style.display = "block"

  const setEl = (id: string, text: string) => {
    const el = document.getElementById(id)
    if (el) el.textContent = text
  }

  setEl(`${prefix}lifetime-rolls`, String(stats.totalRolls))
  setEl(`${prefix}lifetime-victories`, String(stats.totalVictories))

  const diceRate =
    stats.diceRolls.total > 0
      ? Math.round((stats.diceRolls.successes / stats.diceRolls.total) * 100) + "%"
      : "--"
  setEl(`${prefix}lifetime-dice-rate`, diceRate)

  const flashRate =
    stats.flashcards.total > 0
      ? Math.round((stats.flashcards.correct / stats.flashcards.total) * 100) + "%"
      : "--"
  setEl(`${prefix}lifetime-flash-rate`, flashRate)

  // Lifetime technique performance (only in victory view, not fallback)
  const perfEl = document.getElementById("lifetime-performance")
  const strengthsList = document.getElementById("lifetime-strengths")
  const weaknessesList = document.getElementById("lifetime-weaknesses")

  if (!perfEl || !strengthsList || !weaknessesList) return

  const entries = Object.entries(stats.techniques)
  if (entries.length < 2) return

  const strengths: TechniqueRecord[] = []
  const weaknesses: TechniqueRecord[] = []

  for (const [name, t] of entries) {
    const total = t.diceAttempts + t.flashcardAttempts
    const successes = t.diceSuccesses + t.flashcardCorrect
    if (total === 0) continue

    const rate = successes / total
    const record = { name, attempts: total, successes }
    if (rate >= 0.5) {
      strengths.push(record)
    } else {
      weaknesses.push(record)
    }
  }

  strengths.sort((a, b) => b.successes / b.attempts - a.successes / a.attempts)
  weaknesses.sort((a, b) => b.attempts - a.attempts)

  // Only show top 5 of each
  renderReportList(strengthsList, strengths.slice(0, 5), "Keep drilling!", "strength")
  renderReportList(weaknessesList, weaknesses.slice(0, 5), "Clean sheet", "weakness")

  perfEl.style.display = "block"
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
  safeSetItem("bjj-journey", "[]")
  sessionStorage.removeItem("victory-data")
  clearRollHistory()
  navigateToRandomPosition()
}

function handleStartRoll() {
  safeSetItem("bjj-journey", "[]")
  sessionStorage.removeItem("victory-data")
  clearRollHistory()
  navigateToRandomPosition()
}

function showSavePromptIfNeeded(container: HTMLElement) {
  const supabaseUrl = (window as any).__SUPABASE_URL as string | undefined
  if (!supabaseUrl) return
  const ref = supabaseUrl.replace("https://", "").split(".")[0]
  try {
    const raw = localStorage.getItem(`sb-${ref}-auth-token`)
    if (raw && JSON.parse(raw)?.access_token) return // already authenticated
  } catch {
    // no token
  }
  if (container.querySelector(".save-prompt")) return
  const prompt = document.createElement("div")
  prompt.className = "save-prompt"
  prompt.innerHTML = `<span>Sign up to track your lifetime stats across devices</span><button class="save-prompt-btn">Sign up free</button>`
  prompt.querySelector("button")?.addEventListener("click", () => {
    ;(window as any).openAuthModal?.("signup")
  })
  container.appendChild(prompt)
}

document.addEventListener("nav", () => {
  const victoryDisplay = document.getElementById("victory-display")
  if (!victoryDisplay) return

  const victoryContent = document.getElementById("victory-content")
  const victoryFallback = document.getElementById("victory-fallback")
  const victoryEffect = document.getElementById("victory-effect")
  const victoryTitle = document.getElementById("victory-title")
  const victorySubtitle = document.getElementById("victory-subtitle")
  const statMoves = document.getElementById("stat-moves")
  const statDiceWon = document.getElementById("stat-dice-won")
  const statDiceLost = document.getElementById("stat-dice-lost")
  const statFlashRight = document.getElementById("stat-flash-right")
  const statFlashWrong = document.getElementById("stat-flash-wrong")
  const journeyPath = document.getElementById("journey-path")
  const rollAgainBtn = document.getElementById("roll-again-btn")
  const startRollBtn = document.getElementById("start-roll-btn")

  if (
    !victoryContent ||
    !victoryFallback ||
    !statMoves ||
    !statDiceWon ||
    !statDiceLost ||
    !statFlashRight ||
    !statFlashWrong ||
    !journeyPath
  ) {
    return
  }

  const victoryDataRaw = sessionStorage.getItem("victory-data")

  if (victoryDataRaw) {
    try {
      const victoryData: VictoryData = JSON.parse(victoryDataRaw)
      const journey = victoryData.journey || []

      // Compute current roll stats
      const totalMoves = journey.length

      const diceSteps = journey.filter(
        (s) => inferAction(s) === "dice-roll" && s.success !== undefined,
      )
      const diceWon = diceSteps.filter((s) => s.success === true).length
      const diceLost = diceSteps.filter((s) => s.success === false).length

      const flashSteps = journey.filter(
        (s) => inferAction(s) === "flashcard" && s.success !== undefined,
      )
      const flashRight = flashSteps.filter((s) => s.success === true).length
      const flashWrong = flashSteps.filter((s) => s.success === false).length

      statMoves.textContent = String(totalMoves)
      statDiceWon.textContent = String(diceWon)
      statDiceLost.textContent = String(diceLost)
      statFlashRight.textContent = String(flashRight)
      statFlashWrong.textContent = String(flashWrong)

      if (victoryTitle && victoryData.submissionName) {
        victoryTitle.textContent = `Victory by ${victoryData.submissionName}!`
      }

      if (victorySubtitle) {
        const totalSuccesses = diceWon + flashRight
        const totalFailures = diceLost + flashWrong
        if (totalMoves === 1) {
          victorySubtitle.textContent = "Lightning fast submission!"
        } else if (totalFailures === 0) {
          victorySubtitle.textContent = "Flawless victory - perfect technique!"
        } else if (totalSuccesses > totalFailures) {
          victorySubtitle.textContent = "Great work! You outmaneuvered your opponent."
        } else {
          victorySubtitle.textContent = "Hard-fought victory!"
        }
      }

      // Game mode badge
      const settings = loadSettings()
      if (victorySubtitle && settings.gameMode !== "off") {
        const modeBadge = document.createElement("span")
        modeBadge.className = "victory-mode-badge"
        modeBadge.textContent = `Mode: ${settings.gameMode.charAt(0).toUpperCase() + settings.gameMode.slice(1)}`
        victorySubtitle.insertAdjacentElement("afterend", modeBadge)
      }

      // Performance report
      renderReport(journey)

      // Journey path — use ?roll= URL param if available, fallback to localStorage journey
      journeyPath.innerHTML = ""

      const rollParam = getRollParam()
      if (rollParam) {
        // Decode roll URL asynchronously and render
        decodeRollUrl(rollParam).then((rollNames) => {
          rollNames.forEach((name, idx) => {
            const stepEl = document.createElement("span")
            stepEl.className = "journey-step transition"
            stepEl.textContent = name
            journeyPath.appendChild(stepEl)

            if (idx < rollNames.length - 1) {
              const arrow = document.createElement("span")
              arrow.className = "journey-arrow"
              arrow.textContent = " \u2192 "
              journeyPath.appendChild(arrow)
            }
          })
        })
        clearRollUrl()
        clearRollHistory()
      } else {
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
      }

      // Accumulate into lifetime stats
      const lifetimeStats = accumulateStats(journey)

      victoryContent.style.display = "block"
      victoryFallback.style.display = "none"
      hideAllContent()

      if (victoryEffect) {
        createCosmicBurst(victoryEffect)
      }
      playGameSound("victory")

      // Render lifetime stats in victory view
      renderLifetimeStats(lifetimeStats, "")

      // Show "sign up to save" prompt for unauthenticated users
      showSavePromptIfNeeded(victoryContent)

      sessionStorage.removeItem("victory-data")
    } catch {
      victoryContent.style.display = "none"
      victoryFallback.style.display = "block"
      hideAllContent()

      // Still show lifetime stats in fallback
      renderLifetimeStats(loadLifetimeStats(), "fallback-")
    }
  } else {
    victoryContent.style.display = "none"
    victoryFallback.style.display = "block"
    hideAllContent()

    // Show lifetime stats in fallback if any exist
    renderLifetimeStats(loadLifetimeStats(), "fallback-")
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
