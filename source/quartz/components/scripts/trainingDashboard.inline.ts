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
} from "./srs"
import type { SRSCard } from "./srs"
import {
  loadSettings,
  saveSettings,
  loadDailyProgress,
  incrementLearned,
  incrementReviewed,
} from "./settings"
import { removeAllChildren } from "./util"

interface QuestionBankEntry {
  name: string
  type: "transition" | "submission"
  slug: string
  knowledgeAssessment: Array<{ question: string; answer: string }>
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

  renderDashboard()
  initSettings()

  // Search input
  const searchInput = document.getElementById("training-search-input") as HTMLInputElement
  const searchResults = document.getElementById("technique-search-results")

  if (searchInput && searchResults) {
    searchInput.addEventListener("input", handleSearchInput)
  }

  function renderDashboard() {
    const due = getDueCards()
    const upcoming = getUpcomingCards()
    const mastered = getMasteredCards()

    // Summary stats
    const setCount = (id: string, count: number) => {
      const el = document.getElementById(id)
      if (el) el.textContent = String(count)
    }
    setCount("training-due-count", due.length)
    setCount("training-upcoming-count", upcoming.length)
    setCount("training-mastered-count", mastered.length)

    // Daily goals
    renderDailyGoals()

    // Coverage
    renderCoverage()

    // Timeline
    renderTimeline()

    // Render card lists
    renderCardList("training-due-list", due, true)
    renderCardList("training-upcoming-list", upcoming, false)
    renderCardList("training-mastered-list", mastered, false)
  }

  function renderDailyGoals() {
    const settings = loadSettings()
    const progress = loadDailyProgress()

    const learnProgress = document.getElementById("training-learn-progress")
    const learnFill = document.getElementById("training-learn-fill")
    const reviewProgress = document.getElementById("training-review-progress")
    const reviewFill = document.getElementById("training-review-fill")

    if (learnProgress) {
      learnProgress.textContent = `${progress.learned}/${settings.dailyLearnGoal}`
    }
    if (learnFill) {
      const pct = Math.min((progress.learned / settings.dailyLearnGoal) * 100, 100)
      learnFill.style.width = `${pct}%`
      learnFill.classList.toggle("goal-met", progress.learned >= settings.dailyLearnGoal)
    }

    if (reviewProgress) {
      reviewProgress.textContent = `${progress.reviewed}/${settings.dailyReviewGoal}`
    }
    if (reviewFill) {
      const pct = Math.min((progress.reviewed / settings.dailyReviewGoal) * 100, 100)
      reviewFill.style.width = `${pct}%`
      reviewFill.classList.toggle("goal-met", progress.reviewed >= settings.dailyReviewGoal)
    }
  }

  function renderCoverage() {
    const container = document.getElementById("training-coverage")
    if (!container) return
    removeAllChildren(container)

    const allCards = loadSRSCards()
    const studyingSet = new Set(allCards.map((c) => c.technique))

    let totalTransitions = 0
    let studyingTransitions = 0
    let totalSubmissions = 0
    let studyingSubmissions = 0

    for (const entry of questionBank) {
      if (entry.type === "transition") {
        totalTransitions++
        if (studyingSet.has(entry.name)) studyingTransitions++
      } else {
        totalSubmissions++
        if (studyingSet.has(entry.name)) studyingSubmissions++
      }
    }

    const total = totalTransitions + totalSubmissions
    const studying = studyingTransitions + studyingSubmissions
    const pct = total > 0 ? Math.round((studying / total) * 100) : 0

    container.innerHTML = `
      <div class="coverage-overall">
        <span class="coverage-text">Studying <strong>${studying}</strong> of <strong>${total}</strong> techniques (${pct}%)</span>
        <div class="coverage-bar">
          <div class="coverage-fill" style="width: ${pct}%"></div>
        </div>
      </div>
      <div class="coverage-breakdown">
        <div class="coverage-type">
          <span class="type-badge type-transition">transitions</span>
          <span>${studyingTransitions}/${totalTransitions}</span>
        </div>
        <div class="coverage-type">
          <span class="type-badge type-submission">submissions</span>
          <span>${studyingSubmissions}/${totalSubmissions}</span>
        </div>
      </div>
    `
  }

  function renderTimeline() {
    const container = document.getElementById("training-timeline")
    if (!container) return
    removeAllChildren(container)

    const allCards = loadSRSCards()
    if (allCards.length === 0) {
      container.innerHTML =
        '<div class="training-empty">Add techniques to start tracking your journey</div>'
      return
    }

    const now = new Date().toISOString().slice(0, 10)

    // Sort by next review (most urgent first)
    const sorted = [...allCards].sort((a, b) => a.nextReview.localeCompare(b.nextReview))

    for (const card of sorted) {
      const row = document.createElement("div")
      row.className = "timeline-row"

      // Status indicator
      let statusClass: string
      let statusLabel: string
      const isMastered = card.repetitions >= 5 && card.easeFactor >= 2.5
      if (isMastered) {
        statusClass = "mastered"
        statusLabel = "Mastered"
      } else if (card.nextReview < now) {
        statusClass = "overdue"
        statusLabel = "Overdue"
      } else if (card.nextReview === now) {
        statusClass = "due"
        statusLabel = "Due today"
      } else {
        statusClass = "upcoming"
        statusLabel = formatFutureDate(card.nextReview)
      }

      // First review date (date learned)
      const dateLearned =
        card.history.length > 0 ? card.history[0].date : card.lastReview || card.nextReview

      row.innerHTML = `
        <div class="timeline-status timeline-${statusClass}" title="${statusLabel}"></div>
        <div class="timeline-info">
          <span class="timeline-name">${card.technique}</span>
          <span class="type-badge type-${card.type}">${card.type}</span>
        </div>
        <div class="timeline-meta">
          <span class="timeline-learned" title="Date learned">Learned ${formatDate(dateLearned)}</span>
          <span class="timeline-next">${statusLabel}</span>
        </div>
      `
      container.appendChild(row)
    }
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

  function initSettings() {
    const toggle = document.getElementById("training-settings-toggle")
    const panel = document.getElementById("training-settings")
    const arrow = document.getElementById("training-settings-arrow")

    if (toggle && panel && arrow) {
      toggle.addEventListener("click", handleSettingsToggle)
    }

    // Load current values
    const settings = loadSettings()
    const opponentToggle = document.getElementById("setting-opponent-on-fail") as HTMLInputElement
    const learnInput = document.getElementById("setting-daily-learn") as HTMLInputElement
    const reviewInput = document.getElementById("setting-daily-review") as HTMLInputElement

    if (opponentToggle) {
      opponentToggle.checked = settings.opponentOnFail
      opponentToggle.addEventListener("change", handleSettingChange)
    }
    if (learnInput) {
      learnInput.value = String(settings.dailyLearnGoal)
      learnInput.addEventListener("change", handleSettingChange)
    }
    if (reviewInput) {
      reviewInput.value = String(settings.dailyReviewGoal)
      reviewInput.addEventListener("change", handleSettingChange)
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

  function handleSettingChange() {
    const opponentToggle = document.getElementById("setting-opponent-on-fail") as HTMLInputElement
    const learnInput = document.getElementById("setting-daily-learn") as HTMLInputElement
    const reviewInput = document.getElementById("setting-daily-review") as HTMLInputElement

    const settings = loadSettings()
    if (opponentToggle) settings.opponentOnFail = opponentToggle.checked
    if (learnInput) settings.dailyLearnGoal = Math.max(1, parseInt(learnInput.value) || 3)
    if (reviewInput) settings.dailyReviewGoal = Math.max(1, parseInt(reviewInput.value) || 10)

    saveSettings(settings)
    renderDailyGoals()
  }

  function renderCardList(listId: string, cards: SRSCard[], showTrainBtn: boolean) {
    const list = document.getElementById(listId)
    if (!list) return
    removeAllChildren(list)

    if (cards.length === 0) {
      const empty = document.createElement("div")
      empty.className = "training-empty"
      empty.textContent = showTrainBtn ? "No cards due for review" : "No cards yet"
      list.appendChild(empty)
      return
    }

    for (const card of cards) {
      const row = document.createElement("div")
      row.className = "training-card-row"

      const intervalText =
        card.interval < 1
          ? "< 1 day"
          : card.interval < 30
            ? `${Math.round(card.interval)} day${Math.round(card.interval) !== 1 ? "s" : ""}`
            : `${Math.round(card.interval / 30)} month${Math.round(card.interval / 30) !== 1 ? "s" : ""}`

      row.innerHTML = `
        <span class="training-card-name">${card.technique}</span>
        <span class="type-badge type-${card.type}">${card.type}</span>
        <span class="training-card-interval">${intervalText}</span>
        ${showTrainBtn ? '<button class="training-train-btn">Train</button>' : ""}
        <button class="training-remove-btn" aria-label="Remove" title="Remove">&times;</button>
      `

      if (showTrainBtn) {
        row.querySelector(".training-train-btn")?.addEventListener("click", () => {
          startTraining(card.technique)
        })
      }

      row.querySelector(".training-remove-btn")?.addEventListener("click", () => {
        removeCard(card.technique)
        renderDashboard()
      })

      list.appendChild(row)
    }
  }

  function startTraining(technique: string) {
    currentTrainingTechnique = technique
    const entry = bankMap.get(technique)
    if (!entry || entry.knowledgeAssessment.length === 0) return

    const area = document.getElementById("training-flashcard-area")
    if (!area) return
    area.style.display = "block"

    // Pick a random question
    const qa =
      entry.knowledgeAssessment[Math.floor(Math.random() * entry.knowledgeAssessment.length)]
    currentQuestionIndex = entry.knowledgeAssessment.indexOf(qa)

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

    // Scroll to flashcard
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
  }

  function handleAgain() {
    if (currentTrainingTechnique) {
      reviewCard(currentTrainingTechnique, "again")
      incrementReviewed()
    }
    // Re-show same question
    const answer = document.getElementById("training-flashcard-answer")
    if (answer) answer.style.display = "none"
    if (revealBtn) revealBtn.style.display = "block"
    const resultBtns = document.getElementById("training-result-btns")
    if (resultBtns) resultBtns.style.display = "none"
  }

  function handleHard() {
    if (currentTrainingTechnique) {
      reviewCard(currentTrainingTechnique, "hard")
      incrementReviewed()
    }
    hideTraining()
    renderDashboard()
  }

  function handleEasy() {
    if (currentTrainingTechnique) {
      reviewCard(currentTrainingTechnique, "easy")
      incrementReviewed()
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
        addCard(match.name, match.type, match.slug)
        incrementLearned()
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
    const opponentToggle = document.getElementById("setting-opponent-on-fail") as HTMLInputElement
    const learnInput = document.getElementById("setting-daily-learn") as HTMLInputElement
    const reviewInput = document.getElementById("setting-daily-review") as HTMLInputElement
    opponentToggle?.removeEventListener("change", handleSettingChange)
    learnInput?.removeEventListener("change", handleSettingChange)
    reviewInput?.removeEventListener("change", handleSettingChange)
  })
})
