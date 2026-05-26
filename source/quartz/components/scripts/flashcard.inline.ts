// Flashcard - Anki-style 3-button model (Again/Hard/Easy) with SRS.
// Reads per-page graph data injected at build time (no runtime fetch).
import { findCard, addCard, reviewCard, masterFlashcard } from "./srs"
import { incrementLearned, incrementReviewed, updateStreak } from "./settings"
import { isInSession, advanceSession, getSession } from "./trainingSession"

type FlashcardPageType = "transition" | "submission" | "position" | "principle" | "system"

interface PageGraphData {
  type: FlashcardPageType
  name: string
  endingPosition?: string
  endingPositionPath?: string
  isTerminal?: boolean
  isFamily?: boolean
  flashcards: Array<{ question: string; answer: string }>
}

interface JourneyStep {
  slug: string
  name: string
  type: "position" | "transition" | "submission" | "principle" | "system"
  success?: boolean
  action?: "dice-roll" | "flashcard" | "opponent-turn"
  rating?: "again" | "hard" | "easy"
}

const VALID_PAGE_TYPES = new Set<FlashcardPageType>([
  "transition",
  "submission",
  "position",
  "principle",
  "system",
])

function getPageData(): PageGraphData | null {
  const el = document.getElementById("page-graph-data")
  if (!el?.textContent) return null
  try {
    const data = JSON.parse(el.textContent)
    if (VALID_PAGE_TYPES.has(data.type)) return data
    return null
  } catch {
    return null
  }
}

// One-time SRS migration: questionsMastered → flashcardsMastered.
// Idempotent: runs only if the old field is present and the new one is not.
function migrateSRSFieldNames() {
  try {
    const raw = localStorage.getItem("bjj-srs-cards")
    if (!raw) return
    const cards = JSON.parse(raw)
    if (!Array.isArray(cards)) return
    let dirty = false
    for (const c of cards) {
      if (c && typeof c === "object" && "questionsMastered" in c && !("flashcardsMastered" in c)) {
        c.flashcardsMastered = c.questionsMastered
        delete c.questionsMastered
        dirty = true
      }
    }
    if (dirty) localStorage.setItem("bjj-srs-cards", JSON.stringify(cards))
  } catch {
    // corrupt storage — ignore
  }
}
migrateSRSFieldNames()

// Per-user banned flashcards. A ban keys off the technique name + question text
// so it stays stable even if a flashcard's index shifts in the source JSON.
// Stored as a flat array of "technique::question" strings in localStorage.
const BANNED_KEY = "bjj-banned-flashcards"

function loadBannedFlashcards(): Set<string> {
  try {
    const raw = localStorage.getItem(BANNED_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? new Set(arr) : new Set()
  } catch {
    return new Set()
  }
}

function banFlashcard(technique: string, question: string) {
  const banned = loadBannedFlashcards()
  banned.add(`${technique}::${question}`)
  localStorage.setItem(BANNED_KEY, JSON.stringify(Array.from(banned)))
}

function isFlashcardBanned(banned: Set<string>, technique: string, question: string): boolean {
  return banned.has(`${technique}::${question}`)
}

function formatInterval(days: number): string {
  if (days < 1) return "1d"
  if (days < 30) return `${Math.round(days)}d`
  return `${Math.round(days / 30)}mo`
}

function getIntervalPreviews(techniqueName: string): { again: string; hard: string; easy: string } {
  const card = findCard(techniqueName)
  if (!card) {
    return { again: "1d", hard: "1d", easy: "3d" }
  }
  const againInterval = 1
  const hardInterval = Math.max(1, card.interval * 1.2)
  const easyInterval = Math.max(1, card.interval * card.easeFactor)
  return {
    again: formatInterval(againInterval),
    hard: formatInterval(hardInterval),
    easy: formatInterval(easyInterval),
  }
}

// Journey tracking in localStorage
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

// Expose journey functions globally
;(window as any).getJourney = getJourney
;(window as any).clearJourney = clearJourney
;(window as any).addToJourney = addToJourney

document.addEventListener("nav", () => {
  const container = document.getElementById("flashcard-container")
  if (!container) return

  // Get page type from data attribute
  const pageType = container.dataset.pageType as FlashcardPageType | undefined
  if (!pageType) return

  const data = getPageData()
  if (!data || data.type !== pageType) {
    container.style.display = "none"
    return
  }

  const currentPath = window.location.pathname

  if (!data.flashcards || data.flashcards.length === 0) {
    container.style.display = "none"
    return
  }

  // Check SRS status for this technique
  const srsCard = findCard(data.name)
  const isSRSDue = srsCard && srsCard.nextReview <= new Date().toISOString().slice(0, 10)
  const isMastered = srsCard && srsCard.repetitions >= 5 && srsCard.easeFactor >= 2.5

  // Show the container, reset to minimized state on every page load
  container.style.display = "block"
  container.classList.add("flashcard-minimized")

  const flashcardEl = document.getElementById("flashcard")
  const inSession = isInSession()

  if (flashcardEl) {
    flashcardEl.classList.add("hidden")
    flashcardEl.style.display = "none"
  }

  // Get DOM elements (let — will be reassigned after cloning to strip old listeners)
  const minQuestionEl = document.getElementById("flashcard-min-question")
  let minShowBtn = document.getElementById("flashcard-min-show")
  const questionEl = document.getElementById("flashcard-question")
  let answerEl = document.getElementById("flashcard-answer")
  let revealBtn = document.getElementById("reveal-btn")
  let resultBtns = document.getElementById("result-btns")
  let againBtn = document.getElementById("again-btn")
  let hardBtn = document.getElementById("hard-btn")
  let easyBtn = document.getElementById("easy-btn")
  let skipBtn = document.getElementById("skip-btn")

  if (
    !questionEl ||
    !answerEl ||
    !revealBtn ||
    !resultBtns ||
    !againBtn ||
    !hardBtn ||
    !easyBtn ||
    !skipBtn ||
    !minQuestionEl ||
    !minShowBtn
  ) {
    console.warn("Flashcard elements not found")
    return
  }

  // Track used questions to avoid repeats
  const usedQuestionIndices: Set<number> = new Set()
  let currentQuestionIndex = -1
  let knownCount = 0 // questions answered Hard or Easy

  const totalQuestions = data.flashcards.length

  // "Add to Training" button
  let addTrainingBtn = document.getElementById("flashcard-add-training")

  // "Add to Training" is only meaningful for technique-shaped pages (transitions +
  // submissions). Positions, principles, and systems aren't added as SRS cards the
  // same way.
  const isTechniqueType = pageType === "transition" || pageType === "submission"

  function updateAddTrainingBtn() {
    if (!addTrainingBtn) return
    if (!isTechniqueType || findCard(data!.name)) {
      addTrainingBtn.classList.add("hidden")
    } else {
      addTrainingBtn.classList.remove("hidden")
    }
  }

  function handleAddTraining() {
    if (!isTechniqueType) return
    const techniqueType = pageType === "submission" ? "submission" : "transition"
    addCard(data!.name, techniqueType as "transition" | "submission", currentPath)
    if (addTrainingBtn) addTrainingBtn.classList.add("hidden")
    const showSnackbar = (window as any).showSnackbar
    if (showSnackbar) {
      showSnackbar({ type: "success", message: `${data!.name} added to training` })
    }
  }

  function getRandomQuestion(): { question: string; answer: string; index: number } | null {
    if (!data || !data.flashcards) return null

    const banned = loadBannedFlashcards()
    const availableIndices = data.flashcards
      .map((_, i) => i)
      .filter((i) => {
        if (usedQuestionIndices.has(i)) return false
        const qa = data!.flashcards[i]
        return !isFlashcardBanned(banned, data!.name, qa.question)
      })

    // All questions exhausted (answered or banned) — return null to signal completion
    if (availableIndices.length === 0) {
      return null
    }

    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)]
    usedQuestionIndices.add(randomIndex)

    return {
      ...data.flashcards[randomIndex],
      index: randomIndex,
    }
  }

  // Whether the "no-navigate" pageType set applies — these pages show the next
  // question in place instead of navigating away on success.
  const stationaryPage =
    pageType === "position" || pageType === "principle" || pageType === "system"

  // Prime the minimized view with the first question text. Does not reveal answer;
  // does not leave the minimized state. Called once on nav, then click on
  // "Show Answer" expands to the full UI.
  function primeMinimizedView() {
    const qa = getRandomQuestion()
    if (!qa) {
      // No questions — hide entirely
      container!.style.display = "none"
      return
    }
    currentQuestionIndex = qa.index
    minQuestionEl!.textContent = qa.question
    // Pre-populate the full UI too so the first click reveals everything instantly
    questionEl!.textContent = qa.question
    answerEl!.textContent = qa.answer
  }

  function showQuestionInFull() {
    // Called for subsequent questions after the first — stays in full UI state.
    // If mastered, show mastered message briefly
    if (isMastered && isTechniqueType) {
      questionEl!.textContent = `${data!.name} — all flashcards mastered!`
      answerEl!.style.display = "none"
      revealBtn!.style.display = "none"
      resultBtns!.style.display = "none"
      setTimeout(() => navigateAfterSuccess(), 1200)
      return
    }

    const qa = getRandomQuestion()

    // All questions completed
    if (!qa) {
      if (stationaryPage) {
        questionEl!.textContent = "All questions completed! Well done."
        answerEl!.style.display = "none"
        revealBtn!.style.display = "none"
        resultBtns!.style.display = "none"
      }
      return
    }

    currentQuestionIndex = qa.index

    // Show/hide "Add to Training" button
    updateAddTrainingBtn()

    questionEl!.textContent = qa.question
    answerEl!.textContent = qa.answer
    answerEl!.style.display = "none"

    revealBtn!.style.display = "block"
    revealBtn!.classList.remove("hidden")
    resultBtns!.style.display = "none"
  }

  // Click on the minimized "Show Answer" pill: expand to full UI AND reveal the
  // answer directly + show Again/Hard/Easy. Matches spec: one click goes from
  // question-only minimized state to full UI with answer visible.
  function expandFromMinimized() {
    container!.classList.remove("flashcard-minimized")
    if (flashcardEl) {
      flashcardEl.classList.remove("hidden")
      flashcardEl.style.display = ""
    }
    updateAddTrainingBtn()
    revealAnswer()
  }

  function revealAnswer() {
    answerEl!.style.display = "block"
    revealBtn!.style.display = "none"
    resultBtns!.style.display = "flex"

    // Show interval previews on buttons (Again has no interval — it means "again")
    const previews = getIntervalPreviews(data!.name)
    againBtn!.textContent = "Again"
    hardBtn!.textContent = `Hard (${previews.hard})`
    easyBtn!.textContent = `Easy (${previews.easy})`
  }

  function handleAgain() {
    // Update SRS if card exists
    const card = findCard(data!.name)
    if (card) {
      reviewCard(data!.name, "again")
      incrementReviewed()
      updateStreak()
    }

    // Show failure snackbar
    const showSnackbar = (window as any).showSnackbar
    if (showSnackbar) {
      showSnackbar({
        type: "failure",
        message: "Keep studying! Try again.",
      })
    }

    // Re-show the SAME question (hide answer, show reveal button)
    // Do NOT call showQuestion() — keep the same question
    answerEl!.style.display = "none"
    revealBtn!.style.display = "block"
    resultBtns!.style.display = "none"
  }

  function recordSuccessfulReview(rating: "hard" | "easy") {
    addToJourney({
      slug: currentPath,
      name: data!.name,
      type: pageType as JourneyStep["type"],
      success: true,
      action: "flashcard",
      rating,
    })

    // Only techniques (transitions + submissions) go into SRS. Positions,
    // principles, and systems still master individual questions so progress
    // is tracked, but we don't auto-add them as SRS cards.
    if (isTechniqueType) {
      const techniqueType = pageType === "submission" ? "submission" : "transition"
      if (!findCard(data!.name)) {
        addCard(data!.name, techniqueType as "transition" | "submission", currentPath)
        incrementLearned()
      }
      reviewCard(data!.name, rating)
    }
    masterFlashcard(data!.name, currentQuestionIndex)
    incrementReviewed()
    updateStreak()

    if (addTrainingBtn) addTrainingBtn.classList.add("hidden")
  }

  function handleHard() {
    knownCount++
    recordSuccessfulReview("hard")
    showSavePromptIfNeeded()
    navigateAfterSuccess()
  }

  function handleEasy() {
    knownCount++
    recordSuccessfulReview("easy")
    showSavePromptIfNeeded()
    navigateAfterSuccess()
  }

  // Training session navigation lives in ./trainingSession — imported above.

  function navigateAfterSuccess() {
    // Stationary pages (positions, principles, systems) keep the user in place
    // and load the next question in the full UI — no navigation away.
    if (stationaryPage) {
      const showSnackbar = (window as any).showSnackbar
      if (showSnackbar) {
        showSnackbar({ type: "success", message: "Correct! Keep practicing." })
      }
      showQuestionInFull()
      return
    }

    // If in training session, auto-advance to next technique
    if (isInSession()) {
      advanceSession()
      return
    }

    if (pageType === "submission") {
      navigateToVictory()
    } else {
      navigateToEndingPosition()
    }
  }

  function navigateToEndingPosition() {
    if (!data || !data.endingPosition) return

    let targetUrl: string

    const endingSlug = data.endingPosition
    const basePath = data.endingPositionPath || endingSlug.split("/")[0]

    const slugParts = endingSlug.split("/")
    const role = slugParts.length > 1 ? slugParts[slugParts.length - 1] : null

    if (role === "top" || role === "bottom") {
      targetUrl = `/Positions/${basePath}/${role.charAt(0).toUpperCase() + role.slice(1)}`
    } else {
      targetUrl = `/Positions/${basePath}`
    }

    sessionStorage.setItem(
      "snackbar",
      JSON.stringify({
        type: "success",
        message: `${data.name} executed successfully!`,
        from: currentPath,
      }),
    )

    window.spaNavigate(new URL(targetUrl, window.location.toString()), false)
  }

  function navigateToVictory() {
    const journey = getJourney()
    sessionStorage.setItem(
      "victory-data",
      JSON.stringify({
        submissionName: data!.name,
        journey: journey,
      }),
    )

    sessionStorage.setItem(
      "snackbar",
      JSON.stringify({
        type: "success",
        message: `Victory by ${data!.name}!`,
        from: currentPath,
      }),
    )

    window.spaNavigate(new URL("/Game-Over", window.location.toString()), false)
  }

  function handleSkip() {
    // One-click: ban this flashcard locally (so it won't appear again for this
    // user on this or any other page), fire a PostHog signal so we can stack
    // skips per question, then move on.
    const qa = data?.flashcards[currentQuestionIndex]
    if (!qa) return

    banFlashcard(data!.name, qa.question)

    if ((window as any).posthog) {
      const payload = {
        page: currentPath,
        technique: data!.name,
        question: qa.question,
      }
      ;(window as any).posthog.capture("flashcard_skipped", payload)
      // Dual-fire the legacy event name so any existing PostHog dashboards /
      // insights filtering on `flashcard_downvote` keep working. Safe to drop
      // once you've confirmed no dashboard references the old name.
      ;(window as any).posthog.capture("flashcard_downvote", payload)
    }

    const showSnackbar = (window as any).showSnackbar
    if (showSnackbar) {
      showSnackbar({ type: "info", message: "Skipped." })
    }

    // Move on to the next flashcard in place. Skip never counts as a review,
    // so don't touch SRS or streaks.
    showQuestionInFull()
  }

  // Strip all existing listeners by cloning, then reassign variables.
  // This prevents listener accumulation when micromorph preserves DOM nodes
  // across SPA navigations (each nav creates new closures that removeEventListener can't match).
  function freshClone(el: HTMLElement): HTMLElement {
    const clone = el.cloneNode(true) as HTMLElement
    el.replaceWith(clone)
    return clone
  }

  revealBtn = freshClone(revealBtn)
  againBtn = freshClone(againBtn)
  hardBtn = freshClone(hardBtn)
  easyBtn = freshClone(easyBtn)
  skipBtn = freshClone(skipBtn)
  minShowBtn = freshClone(minShowBtn)
  if (addTrainingBtn) addTrainingBtn = freshClone(addTrainingBtn)

  revealBtn.addEventListener("click", revealAnswer)
  againBtn.addEventListener("click", handleAgain)
  hardBtn.addEventListener("click", handleHard)
  easyBtn.addEventListener("click", handleEasy)
  skipBtn.addEventListener("click", handleSkip)
  minShowBtn.addEventListener("click", expandFromMinimized)
  // Clicking anywhere on the minimized row (not just the button) expands it.
  const minRow = document.getElementById("flashcard-min")
  if (minRow) {
    minRow.addEventListener("click", (e) => {
      // Don't double-fire if the button was clicked
      if ((e.target as HTMLElement).id === "flashcard-min-show") return
      expandFromMinimized()
    })
  }
  if (addTrainingBtn) addTrainingBtn.addEventListener("click", handleAddTraining)

  // Keyboard shortcuts: Space = Show Answer / reveal, 1/2/3/4 = Again/Hard/Easy/Skip.
  // Gated so they don't hijack typing in inputs, textareas, or contenteditable.
  function isTypingTarget(el: EventTarget | null): boolean {
    if (!(el instanceof HTMLElement)) return false
    const tag = el.tagName
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
    if (el.isContentEditable) return true
    return false
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (isTypingTarget(e.target)) return
    // Only act when this page actually has a visible flashcard
    if (container!.style.display === "none") return

    const isMinimized = container!.classList.contains("flashcard-minimized")
    const answerVisible = answerEl!.style.display === "block"

    // Space: progress to the "answer revealed" state
    if (e.key === " " || e.code === "Space") {
      if (isMinimized) {
        e.preventDefault()
        expandFromMinimized()
      } else if (!answerVisible) {
        e.preventDefault()
        revealAnswer()
      }
      return
    }

    // Rating keys only fire after the answer is revealed
    if (!answerVisible) return
    if (e.key === "1") {
      e.preventDefault()
      handleAgain()
    } else if (e.key === "2") {
      e.preventDefault()
      handleHard()
    } else if (e.key === "3") {
      e.preventDefault()
      handleEasy()
    } else if (e.key === "4") {
      e.preventDefault()
      handleSkip()
    }
  }

  document.addEventListener("keydown", handleKeydown)

  // Clean up on navigation
  window.addCleanup(() => {
    revealBtn!.removeEventListener("click", revealAnswer)
    againBtn!.removeEventListener("click", handleAgain)
    hardBtn!.removeEventListener("click", handleHard)
    easyBtn!.removeEventListener("click", handleEasy)
    skipBtn!.removeEventListener("click", handleSkip)
    minShowBtn!.removeEventListener("click", expandFromMinimized)
    if (addTrainingBtn) addTrainingBtn.removeEventListener("click", handleAddTraining)
    document.removeEventListener("keydown", handleKeydown)
  })

  // Show "sign up to save" prompt for unauthenticated users after first review
  let savePromptShown = false
  function showSavePromptIfNeeded() {
    if (savePromptShown) return
    // Check auth synchronously via Supabase session token
    const supabaseUrl = (window as any).__SUPABASE_URL as string | undefined
    if (!supabaseUrl) return
    const ref = supabaseUrl.replace("https://", "").split(".")[0]
    try {
      const raw = localStorage.getItem(`sb-${ref}-auth-token`)
      if (raw && JSON.parse(raw)?.access_token) return // already authenticated
    } catch {
      // no token
    }
    savePromptShown = true
    const existing = container!.querySelector(".save-prompt")
    if (existing) return
    const prompt = document.createElement("div")
    prompt.className = "save-prompt"
    prompt.innerHTML = `<span>Sign up to save your flashcard progress across devices</span><button class="save-prompt-btn">Sign up free</button>`
    prompt.querySelector("button")?.addEventListener("click", () => {
      ;(window as any).openAuthModal?.("signup")
    })
    container!.appendChild(prompt)
  }

  // Decide initial state. Normally we prime the minimized view (question only,
  // user clicks Show Answer to expand). But if the user landed here via a
  // training session with autoExpand:true (i.e. clicked ▶ on the strip), skip
  // the minimized step and open straight into the expanded UI with the answer
  // revealed and Again/Hard/Easy/Skip ready.
  const sessionForAutoExpand = getSession()
  if (sessionForAutoExpand?.autoExpand) {
    primeMinimizedView()
    expandFromMinimized()
  } else {
    primeMinimizedView()
  }
})
