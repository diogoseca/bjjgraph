// Training Dashboard — SRS review interface
// Reads question bank from build-time injected JSON element
import {
  loadSRSCards,
  getDueCards,
  getUpcomingCards,
  getMasteredCards,
  addCard,
  reviewCard,
  removeCard,
  masterFlashcard,
} from "./srs"
import type { SRSCard } from "./srs"
import {
  loadSettings,
  saveSettings,
  loadDailyProgress,
  decrementLearned,
  incrementReviewed,
  loadStreak,
  updateStreak,
} from "./settings"
import type { GameMode } from "./settings"
import { removeAllChildren } from "./util"
import { loadExplored } from "./explored"

interface QuestionBankEntry {
  name: string
  type: "transition" | "submission" | "position" | "principle" | "system"
  slug: string
  flashcards: Array<{ question: string; answer: string }>
}

function loadQuestionBank(): QuestionBankEntry[] {
  const el = document.getElementById("training-question-bank")
  if (!el?.textContent) return []
  try {
    return JSON.parse(el.textContent)
  } catch {
    return []
  }
}

interface GraphAdjacency {
  positions: Record<string, number[]> // positionHub → bank indices of techniques from that position
  outcomes: string[][] // bank index → position hubs this technique leads to
}

function loadGraphAdjacency(): GraphAdjacency | null {
  const el = document.getElementById("training-graph-adjacency")
  if (!el?.textContent) return null
  try {
    return JSON.parse(el.textContent)
  } catch {
    return null
  }
}

function getSuggestedTechniques(
  questionBank: QuestionBankEntry[],
  existingNames: Set<string>,
  adjacency: GraphAdjacency,
  count: number,
): Array<{ entry: QuestionBankEntry; score: number; reason: string }> {
  const coldStart = existingNames.size === 0

  const knownIndices = new Set<number>()
  questionBank.forEach((entry, idx) => {
    if (existingNames.has(entry.name)) knownIndices.add(idx)
  })

  const idxToPositions: string[][] = []
  for (let i = 0; i < questionBank.length; i++) {
    idxToPositions.push([])
  }
  for (const [pos, indices] of Object.entries(adjacency.positions)) {
    for (const idx of indices) {
      if (idx < idxToPositions.length) idxToPositions[idx].push(pos)
    }
  }

  const scored: Array<{ entry: QuestionBankEntry; score: number; reason: string }> = []

  for (let i = 0; i < questionBank.length; i++) {
    const entry = questionBank[i]
    if (existingNames.has(entry.name)) continue

    let siblingScore = 0
    let chainScore = 0

    for (const pos of idxToPositions[i]) {
      const siblings = adjacency.positions[pos] || []
      for (const sibIdx of siblings) {
        if (sibIdx !== i && (coldStart || knownIndices.has(sibIdx))) siblingScore++
      }
    }

    const outPositions = adjacency.outcomes[i] || []
    for (const pos of outPositions) {
      const targets = adjacency.positions[pos] || []
      for (const tIdx of targets) {
        if (tIdx !== i && (coldStart || knownIndices.has(tIdx))) chainScore++
      }
    }

    const score = siblingScore + chainScore
    if (score === 0) continue

    const reason = coldStart
      ? `${score} connected techniques`
      : siblingScore > 0 && chainScore > 0
        ? `${siblingScore} from same position, ${chainScore} chained`
        : siblingScore > 0
          ? `${siblingScore} from same position`
          : `${chainScore} chained techniques`

    scored.push({ entry, score, reason })
  }

  // Cold start: boost half-guard techniques to appear first
  if (coldStart) {
    for (const s of scored) {
      const idx = questionBank.indexOf(s.entry)
      const positions = idxToPositions[idx] || []
      if (positions.some((p) => p.includes("half-guard"))) {
        s.score += 1000
      }
    }
  }

  scored.sort((a, b) => b.score - a.score)

  // Type-balanced selection: interleave transitions and submissions
  const transitions = scored.filter((s) => s.entry.type === "transition")
  const submissions = scored.filter((s) => s.entry.type === "submission")
  const result: typeof scored = []
  let ti = 0
  let si = 0
  while (result.length < count) {
    const t = transitions[ti]
    const s = submissions[si]
    if (!t && !s) break
    if (!s || (t && t.score >= s.score * 0.5)) {
      result.push(t!)
      ti++
    } else {
      result.push(s!)
      si++
    }
  }
  return result
}

interface SessionQueue {
  pages: Array<{ slug: string; name: string; type: string }>
  currentIndex: number
  completed: number
}

function formatIntervalPreview(days: number): string {
  if (days < 1) return "1d"
  if (days < 30) return `${Math.round(days)}d`
  return `${Math.round(days / 30)}mo`
}

function toRoleSlug(slug: string, type: string): string {
  if (type === "transition" || type === "submission") {
    const clean = slug.replace(/\/$/, "")
    if (!clean.endsWith("/Attacker") && !clean.endsWith("/Defender")) {
      return clean + "/Attacker"
    }
  }
  return slug
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatFutureDate(dateStr: string): string {
  const now = new Date()
  const target = new Date(dateStr + "T00:00:00")
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 1) return "Tomorrow"
  if (diffDays <= 7) return `In ${diffDays} days`
  return formatDate(dateStr)
}

let currentTrainingTechnique: string | null = null
let currentQuestionIndex = -1

document.addEventListener("nav", () => {
  const dashboard = document.getElementById("training-dashboard")
  if (!dashboard) return

  const questionBank = loadQuestionBank()
  if (questionBank.length === 0) return

  const bankMap = new Map<string, QuestionBankEntry>()
  for (const entry of questionBank) {
    bankMap.set(entry.name, entry)
  }

  const GROUP_PAGE_SIZE = Infinity
  const SUGGESTION_PAGE_SIZE = Infinity

  // Scrollable list with fade edges (applied after rendering)
  function setupScrollFade(el: HTMLElement | null) {
    if (!el) return
    // Only add scroll behavior if the list has enough items
    if (el.children.length <= 10) {
      el.classList.remove("training-scroll-list")
      return
    }
    el.classList.add("training-scroll-list")
    const updateFade = () => {
      const atTop = el.scrollTop <= 2
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2
      el.classList.toggle("scroll-top", atTop)
      el.classList.toggle("scroll-bottom", atBottom)
    }
    updateFade()
    el.addEventListener("scroll", updateFade, { passive: true })
    window.addCleanup(() => el.removeEventListener("scroll", updateFade))
  }

  renderDashboard()
  initSettings()

  const searchInput = document.getElementById("training-search-input") as HTMLInputElement
  const searchResults = document.getElementById("technique-search-results")

  if (searchInput && searchResults) {
    searchInput.addEventListener("input", handleSearchInput)
  }

  function renderDashboard() {
    const due = getDueCards()
    const settings = loadSettings()
    const progress = loadDailyProgress()
    const totalDone = progress.learned + progress.reviewed

    // Session header: "TODAY'S SESSION (X OF Y)"
    const sessionHeader = document.getElementById("training-session-header")
    if (sessionHeader) {
      sessionHeader.textContent = `Today's Session (${totalDone} of ${settings.dailyGoal})`
    }

    // Streak
    renderStreak()

    // Daily goals
    renderDailyGoals()

    // Completion message
    renderCompletionMessage()

    // Start Session button
    renderStartSession(due)

    // Known Techniques (unified list)
    renderKnownTechniques()
    setupScrollFade(document.getElementById("training-known-list"))

    // Discover header with count
    const discoverHeader = document.getElementById("training-discover-header")
    if (discoverHeader) {
      const existingNames = new Set(loadSRSCards().map((c) => c.technique))
      const available = questionBank.length - existingNames.size
      discoverHeader.textContent = `Discover (${available} available)`
    }

    // Suggestions
    renderSuggestions()
    setupScrollFade(document.getElementById("training-suggestions"))
  }

  function renderStreak() {
    const el = document.getElementById("training-streak-display")
    if (!el) return
    const streak = loadStreak()
    el.textContent = streak.currentStreak > 0 ? `${streak.currentStreak} day streak` : ""
  }

  function isUserAuthenticated(): boolean {
    const supabaseUrl = (window as any).__SUPABASE_URL as string | undefined
    if (!supabaseUrl) return false
    const ref = supabaseUrl.replace("https://", "").split(".")[0]
    try {
      const raw = localStorage.getItem(`sb-${ref}-auth-token`)
      return !!(raw && JSON.parse(raw)?.access_token)
    } catch {
      return false
    }
  }

  function appendSavePromptToBanner(banner: HTMLElement) {
    if (isUserAuthenticated()) return
    if (banner.querySelector(".save-prompt")) return
    const prompt = document.createElement("div")
    prompt.className = "save-prompt"
    prompt.innerHTML = `<span>Create an account to protect your streak</span><button class="save-prompt-btn">Sign up free</button>`
    prompt.querySelector("button")?.addEventListener("click", () => {
      ;(window as any).openAuthModal?.("signup")
    })
    banner.appendChild(prompt)
  }

  function renderCompletionMessage() {
    const banner = document.getElementById("training-completion-banner")
    if (!banner) return

    const sessionComplete = sessionStorage.getItem("training-session-complete")
    if (sessionComplete) {
      sessionStorage.removeItem("training-session-complete")
      banner.style.display = "block"
      banner.textContent = "Great job! Session complete. Keep up the momentum!"
      appendSavePromptToBanner(banner)
      return
    }

    const settings = loadSettings()
    const progress = loadDailyProgress()
    if (progress.learned + progress.reviewed >= settings.dailyGoal) {
      banner.style.display = "block"
      banner.textContent = "Great job! Daily goal complete. Come back tomorrow!"
      appendSavePromptToBanner(banner)
      return
    }

    banner.style.display = "none"
  }

  function buildSessionQueue(due: SRSCard[]): SessionQueue {
    const pages: SessionQueue["pages"] = []

    const overdueSorted = [...due].sort((a, b) => a.nextReview.localeCompare(b.nextReview))
    for (const card of overdueSorted) {
      pages.push({ slug: toRoleSlug(card.slug, card.type), name: card.technique, type: card.type })
    }

    const settings = loadSettings()
    const progress = loadDailyProgress()
    const existingNames = new Set(loadSRSCards().map((c) => c.technique))
    const totalDone = progress.learned + progress.reviewed
    const remainingSlots = Math.max(0, settings.dailyGoal - due.length - totalDone)

    if (remainingSlots > 0) {
      const adjacency = loadGraphAdjacency()
      if (adjacency) {
        const suggestions = getSuggestedTechniques(
          questionBank,
          existingNames,
          adjacency,
          remainingSlots,
        )
        for (const { entry } of suggestions) {
          pages.push({
            slug: toRoleSlug(entry.slug, entry.type),
            name: entry.name,
            type: entry.type,
          })
        }
      } else {
        const candidates = questionBank.filter((e) => !existingNames.has(e.name))
        const shuffled = candidates.sort(() => Math.random() - 0.5)
        for (const candidate of shuffled.slice(0, remainingSlots)) {
          pages.push({
            slug: toRoleSlug(candidate.slug, candidate.type),
            name: candidate.name,
            type: candidate.type,
          })
        }
      }
    }

    return { pages, currentIndex: 0, completed: 0 }
  }

  function renderStartSession(due: SRSCard[]) {
    const container = document.getElementById("training-session-btn-area")
    if (!container) return
    removeAllChildren(container)

    const completionBanner = document.getElementById("training-completion-banner")
    if (completionBanner && completionBanner.style.display === "block") {
      return
    }

    const existingSession = sessionStorage.getItem("training-session")

    const session = existingSession
      ? (JSON.parse(existingSession) as SessionQueue)
      : buildSessionQueue(due)
    const totalPages = existingSession
      ? session.pages.length - session.currentIndex
      : session.pages.length

    if (totalPages === 0) return

    const progress = loadDailyProgress()
    const totalDone = progress.learned + progress.reviewed

    const btn = document.createElement("button")
    btn.className = "training-start-session-btn"
    btn.textContent = existingSession
      ? `Continue (${totalPages})`
      : totalDone > 0
        ? `Continue (${session.pages.length})`
        : `Start (${session.pages.length})`

    btn.addEventListener("click", () => {
      if (!existingSession) {
        sessionStorage.setItem("training-session", JSON.stringify(session))
      }
      const currentSession = JSON.parse(sessionStorage.getItem("training-session")!) as SessionQueue
      const page = currentSession.pages[currentSession.currentIndex]
      if (page) {
        window.spaNavigate(new URL(page.slug, window.location.toString()), false)
      }
    })

    container.appendChild(btn)
  }

  function renderDailyGoals() {
    const settings = loadSettings()
    const progress = loadDailyProgress()
    const totalDone = progress.learned + progress.reviewed

    const dailyProgress = document.getElementById("training-daily-progress")
    const dailyFill = document.getElementById("training-daily-fill")

    if (dailyProgress) {
      dailyProgress.textContent = `${totalDone}/${settings.dailyGoal}`
    }
    if (dailyFill) {
      const pct = Math.min((totalDone / settings.dailyGoal) * 100, 100)
      dailyFill.style.width = `${pct}%`
      dailyFill.classList.toggle("goal-met", totalDone >= settings.dailyGoal)
    }
  }

  function renderKnownTechniques() {
    const container = document.getElementById("training-known-list")
    const header = document.getElementById("training-known-header")
    if (!container) return
    removeAllChildren(container)

    const allCards = loadSRSCards()
    const now = new Date().toISOString().slice(0, 10)

    // Header with coverage info
    if (header) {
      header.textContent = `Known Techniques (${allCards.length} of ${questionBank.length})`
    }

    if (allCards.length === 0) {
      container.innerHTML =
        '<div class="training-empty">No techniques added yet. Discover new ones below!</div>'
      return
    }

    // Split into groups
    const due: SRSCard[] = []
    const reviewing: SRSCard[] = []
    const mastered: SRSCard[] = []

    for (const card of allCards) {
      const isMastered = card.repetitions >= 5 && card.easeFactor >= 2.5
      if (isMastered) {
        mastered.push(card)
      } else if (card.nextReview <= now) {
        due.push(card)
      } else {
        reviewing.push(card)
      }
    }

    // Sort: due by most overdue, reviewing by next review, mastered by name
    due.sort((a, b) => a.nextReview.localeCompare(b.nextReview))
    reviewing.sort((a, b) => a.nextReview.localeCompare(b.nextReview))
    mastered.sort((a, b) => a.technique.localeCompare(b.technique))

    // Render groups
    if (due.length > 0) {
      renderGroup(container, `Due Today (${due.length})`, due, "due", true)
    }
    if (reviewing.length > 0) {
      renderGroup(container, `Reviewing (${reviewing.length})`, reviewing, "reviewing", false)
    }
    if (mastered.length > 0) {
      renderGroup(container, `Mastered (${mastered.length})`, mastered, "mastered", false)
    }

    // Explored: visited pages not yet in SRS training
    const allCardNames = new Set(allCards.map((c) => c.technique))
    const explored = loadExplored().filter((e) => !allCardNames.has(e.name))
    if (explored.length > 0) {
      const exploredHeader = document.createElement("div")
      exploredHeader.className = "known-group-header known-group-explored"
      exploredHeader.textContent = `Explored (${explored.length})`
      exploredHeader.title = "Pages you've visited but haven't added to training yet"
      container.appendChild(exploredHeader)

      const trainableTypes = new Set(["transition", "submission"])

      for (const entry of explored) {
        const row = document.createElement("div")
        row.className = "explored-row"
        const daysAgo = Math.floor((Date.now() - new Date(entry.firstVisited).getTime()) / 86400000)
        const dateText = daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo}d ago`

        row.innerHTML = `
          <span class="explored-name">${entry.name}</span>
          <span class="type-badge type-${entry.type}">${entry.type}</span>
          <span class="explored-date">${dateText}</span>
        `

        if (trainableTypes.has(entry.type)) {
          const addBtn = document.createElement("button")
          addBtn.className = "training-add-btn"
          addBtn.textContent = "+"
          addBtn.title = "Add to spaced repetition training"
          addBtn.addEventListener("click", () => {
            addCard(entry.name, entry.type as "transition" | "submission", "/" + entry.slug)
            renderDashboard()
          })
          row.appendChild(addBtn)
        }

        container.appendChild(row)
      }
    }
  }

  function renderGroup(
    container: HTMLElement,
    title: string,
    cards: SRSCard[],
    groupClass: string,
    showTrainBtn: boolean,
    limit: number = GROUP_PAGE_SIZE,
  ) {
    const groupHeader = document.createElement("div")
    groupHeader.className = `known-group-header known-group-${groupClass}`
    groupHeader.textContent = title
    container.appendChild(groupHeader)

    const now = new Date().toISOString().slice(0, 10)
    const visibleCards = limit < cards.length ? cards.slice(0, limit) : cards

    for (const card of visibleCards) {
      const row = document.createElement("div")
      row.className = "training-card-row"

      // Mastery % from per-flashcard tracking
      const entry = bankMap.get(card.technique)
      const totalQ = entry?.flashcards.length ?? 0
      const masteredQ = card.flashcardsMastered?.length ?? 0
      const masteryPct = totalQ > 0 ? Math.round((masteredQ / totalQ) * 100) : 0

      // Status text
      let statusText: string
      if (groupClass === "mastered") {
        statusText = card.nextReview > now ? formatFutureDate(card.nextReview) : "Due"
      } else if (groupClass === "due") {
        statusText = card.nextReview < now ? "Overdue" : "Due today"
      } else {
        statusText = formatFutureDate(card.nextReview)
      }

      row.innerHTML = `
        <span class="training-card-name">${card.technique}</span>
        <span class="type-badge type-${card.type}">${card.type}</span>
        <span class="mastery-info" title="${masteredQ}/${totalQ} questions mastered">
          <span class="mastery-bar-container">
            <span class="mastery-bar-fill" style="width: ${masteryPct}%"></span>
          </span>
          <span class="mastery-pct">${masteredQ}/${totalQ}</span>
        </span>
        <span class="training-card-status">${statusText}</span>
        ${showTrainBtn ? '<button class="training-train-btn">Train</button>' : ""}
        <button class="training-remove-btn" aria-label="Remove" title="Remove">&times;</button>
      `

      if (showTrainBtn) {
        row.querySelector(".training-train-btn")?.addEventListener("click", () => {
          startTraining(card.technique)
        })
      }

      row.querySelector(".training-remove-btn")?.addEventListener("click", () => {
        decrementLearned()
        removeCard(card.technique)
        renderDashboard()
      })

      container.appendChild(row)
    }

    // "Show more" button if truncated
    if (limit < cards.length) {
      const remaining = cards.length - limit
      const showMore = document.createElement("button")
      showMore.className = "training-show-more"
      showMore.textContent = `Show more (${remaining})`
      showMore.addEventListener("click", () => {
        // Remove the header and all rows for this group, then re-render with no limit
        // Find and remove elements from groupHeader to showMore
        const siblings: Element[] = []
        let el: Element | null = groupHeader
        while (el && el !== showMore) {
          siblings.push(el)
          el = el.nextElementSibling
        }
        siblings.push(showMore)
        for (const s of siblings) s.remove()
        renderGroup(container, title, cards, groupClass, showTrainBtn, Infinity)
      })
      container.appendChild(showMore)
    }
  }

  function renderSuggestions(limit: number = SUGGESTION_PAGE_SIZE) {
    const container = document.getElementById("training-suggestions")
    if (!container) return
    removeAllChildren(container)

    const adjacency = loadGraphAdjacency()
    if (!adjacency) return

    const existingNames = new Set(loadSRSCards().map((c) => c.technique))
    const allSuggestions = getSuggestedTechniques(questionBank, existingNames, adjacency, 50)

    if (allSuggestions.length === 0) return

    const label = document.createElement("div")
    label.className = "suggestion-label"
    label.textContent = existingNames.size === 0 ? "Start with these" : "Suggested for you"
    container.appendChild(label)

    const visible = limit < allSuggestions.length ? allSuggestions.slice(0, limit) : allSuggestions

    for (const { entry, reason } of visible) {
      const row = document.createElement("div")
      row.className = "suggestion-row"
      row.innerHTML = `
        <span class="suggestion-name">${entry.name}</span>
        <span class="type-badge type-${entry.type}">${entry.type}</span>
        <span class="suggestion-reason">${reason}</span>
        <button class="training-add-btn">+ Add</button>
      `
      row.querySelector(".training-add-btn")?.addEventListener("click", () => {
        if (entry.type === "transition" || entry.type === "submission") {
          addCard(entry.name, entry.type, entry.slug)
          renderDashboard()
        }
      })
      container.appendChild(row)
    }

    // "Show more" button if truncated
    if (limit < allSuggestions.length) {
      const remaining = allSuggestions.length - limit
      const showMore = document.createElement("button")
      showMore.className = "training-show-more"
      showMore.textContent = `Show more (${remaining})`
      showMore.addEventListener("click", () => {
        renderSuggestions(limit + SUGGESTION_PAGE_SIZE)
      })
      container.appendChild(showMore)
    }
  }

  function initSettings() {
    const toggle = document.getElementById("training-settings-toggle")
    const panel = document.getElementById("training-settings")
    const arrow = document.getElementById("training-settings-arrow")

    if (toggle && panel && arrow) {
      toggle.addEventListener("click", handleSettingsToggle)
    }

    const settings = loadSettings()

    // Game mode pill selector
    const gameModeSelector = document.getElementById("game-mode-selector")
    if (gameModeSelector) {
      const buttons = gameModeSelector.querySelectorAll(".game-mode-btn")
      buttons.forEach((btn) => {
        const mode = (btn as HTMLElement).dataset.mode
        if (mode === settings.gameMode) btn.classList.add("active")
        if (!btn.classList.contains("game-mode-btn--locked")) {
          btn.addEventListener("click", handleGameModeChange)
        }
      })
    }

    const goalInput = document.getElementById("setting-daily-goal") as HTMLInputElement
    if (goalInput) {
      goalInput.value = String(settings.dailyGoal)
      goalInput.addEventListener("change", handleSettingChange)
    }
    const flashcardToggle = document.getElementById("setting-show-flashcards") as HTMLInputElement
    if (flashcardToggle) {
      flashcardToggle.checked = settings.showFlashcards
      flashcardToggle.addEventListener("change", handleSettingChange)
    }
  }

  function handleSettingsToggle() {
    const panel = document.getElementById("training-settings")
    const arrow = document.getElementById("training-settings-arrow")
    if (!panel || !arrow) return
    const visible = panel.style.display !== "none"
    panel.style.display = visible ? "none" : "block"
    arrow.textContent = visible ? "\u25B6" : "\u25BC"
  }

  function handleGameModeChange(e: Event) {
    const btn = e.currentTarget as HTMLElement
    const mode = btn.dataset.mode as GameMode
    if (!mode || mode === "hard" || mode === "ultra") return

    const selector = document.getElementById("game-mode-selector")
    if (selector) {
      selector.querySelectorAll(".game-mode-btn").forEach((b) => b.classList.remove("active"))
    }
    btn.classList.add("active")

    const settings = loadSettings()
    settings.gameMode = mode
    saveSettings(settings)
  }

  function handleSettingChange() {
    const goalInput = document.getElementById("setting-daily-goal") as HTMLInputElement
    const flashcardToggle = document.getElementById("setting-show-flashcards") as HTMLInputElement

    const settings = loadSettings()
    if (goalInput) settings.dailyGoal = Math.max(1, parseInt(goalInput.value) || 30)
    if (flashcardToggle) settings.showFlashcards = flashcardToggle.checked

    saveSettings(settings)
    renderDailyGoals()
  }

  function startTraining(technique: string) {
    currentTrainingTechnique = technique
    const entry = bankMap.get(technique)
    if (!entry || entry.flashcards.length === 0) return

    const area = document.getElementById("training-flashcard-area")
    if (!area) return
    area.style.display = "block"

    const qa = entry.flashcards[Math.floor(Math.random() * entry.flashcards.length)]
    currentQuestionIndex = entry.flashcards.indexOf(qa)

    const label = document.getElementById("training-flashcard-label")
    const question = document.getElementById("training-flashcard-question")
    const answer = document.getElementById("training-flashcard-answer")
    const revealBtn = document.getElementById("training-reveal-btn")
    const resultBtns = document.getElementById("training-result-btns")

    if (label) label.textContent = `Training: ${technique}`
    if (question) question.textContent = qa.question
    if (answer) {
      answer.textContent = qa.answer
      answer.style.display = "none"
    }
    if (revealBtn) revealBtn.style.display = "block"
    if (resultBtns) resultBtns.style.display = "none"

    area.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  function hideTraining() {
    const area = document.getElementById("training-flashcard-area")
    if (area) area.style.display = "none"
    currentTrainingTechnique = null
  }

  // Wire flashcard buttons
  const revealBtn = document.getElementById("training-reveal-btn")
  const againBtn = document.getElementById("training-again-btn")
  const hardBtn = document.getElementById("training-hard-btn")
  const easyBtn = document.getElementById("training-easy-btn")

  function handleReveal() {
    const answer = document.getElementById("training-flashcard-answer")
    const resultBtns = document.getElementById("training-result-btns")
    if (answer) answer.style.display = "block"
    if (revealBtn) revealBtn.style.display = "none"
    if (resultBtns) resultBtns.style.display = "flex"

    if (currentTrainingTechnique) {
      const card = loadSRSCards().find((c) => c.technique === currentTrainingTechnique)
      let hardPrev: string, easyPrev: string
      if (!card) {
        hardPrev = "1d"
        easyPrev = "3d"
      } else {
        hardPrev = formatIntervalPreview(Math.max(1, card.interval * 1.2))
        easyPrev = formatIntervalPreview(Math.max(1, card.interval * card.easeFactor))
      }
      if (againBtn) againBtn.textContent = "Again"
      if (hardBtn) hardBtn.textContent = `Hard (${hardPrev})`
      if (easyBtn) easyBtn.textContent = `Easy (${easyPrev})`
    }
  }

  function handleAgain() {
    if (currentTrainingTechnique) {
      reviewCard(currentTrainingTechnique, "again")
      incrementReviewed()
      updateStreak()
    }
    const answer = document.getElementById("training-flashcard-answer")
    if (answer) answer.style.display = "none"
    if (revealBtn) revealBtn.style.display = "block"
    const resultBtns = document.getElementById("training-result-btns")
    if (resultBtns) resultBtns.style.display = "none"
  }

  function handleHard() {
    if (currentTrainingTechnique) {
      reviewCard(currentTrainingTechnique, "hard")
      masterFlashcard(currentTrainingTechnique, currentQuestionIndex)
      incrementReviewed()
      updateStreak()
    }
    hideTraining()
    renderDashboard()
  }

  function handleEasy() {
    if (currentTrainingTechnique) {
      reviewCard(currentTrainingTechnique, "easy")
      masterFlashcard(currentTrainingTechnique, currentQuestionIndex)
      incrementReviewed()
      updateStreak()
    }
    hideTraining()
    renderDashboard()
  }

  revealBtn?.addEventListener("click", handleReveal)
  againBtn?.addEventListener("click", handleAgain)
  hardBtn?.addEventListener("click", handleHard)
  easyBtn?.addEventListener("click", handleEasy)

  function handleSearchInput() {
    const query = searchInput.value.trim().toLowerCase()
    removeAllChildren(searchResults!)

    if (query.length < 2) return

    const existingCards = new Set(loadSRSCards().map((c) => c.technique))
    const matches = questionBank
      .filter((e) => e.name.toLowerCase().includes(query) && !existingCards.has(e.name))
      .slice(0, 8)

    for (const match of matches) {
      const row = document.createElement("div")
      row.className = "search-result-row"
      row.innerHTML = `
        <span class="search-result-name">${match.name}</span>
        <span class="search-result-type type-badge type-${match.type}">${match.type}</span>
        <button class="training-add-btn">+ Add</button>
      `
      row.querySelector(".training-add-btn")?.addEventListener("click", () => {
        if (match.type === "transition" || match.type === "submission") {
          addCard(match.name, match.type, match.slug)
        }
        searchInput.value = ""
        removeAllChildren(searchResults!)
        renderDashboard()
      })
      searchResults!.appendChild(row)
    }

    if (matches.length === 0) {
      const empty = document.createElement("div")
      empty.className = "search-result-empty"
      empty.textContent = "No matching techniques found"
      searchResults!.appendChild(empty)
    }
  }

  // Cleanup
  window.addCleanup(() => {
    revealBtn?.removeEventListener("click", handleReveal)
    againBtn?.removeEventListener("click", handleAgain)
    hardBtn?.removeEventListener("click", handleHard)
    easyBtn?.removeEventListener("click", handleEasy)
    searchInput?.removeEventListener("input", handleSearchInput)
    document
      .getElementById("training-settings-toggle")
      ?.removeEventListener("click", handleSettingsToggle)
    const gameModeSelector = document.getElementById("game-mode-selector")
    if (gameModeSelector) {
      gameModeSelector
        .querySelectorAll(".game-mode-btn:not(.game-mode-btn--locked)")
        .forEach((btn) => btn.removeEventListener("click", handleGameModeChange))
    }
    const goalInput = document.getElementById("setting-daily-goal") as HTMLInputElement
    goalInput?.removeEventListener("change", handleSettingChange)
    const flashcardToggle = document.getElementById("setting-show-flashcards") as HTMLInputElement
    flashcardToggle?.removeEventListener("change", handleSettingChange)
  })
})
