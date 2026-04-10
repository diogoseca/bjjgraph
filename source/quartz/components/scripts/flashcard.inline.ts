// Flashcard Knowledge Test - Anki-style 3-button model (Again/Hard/Easy) with SRS
// Reads per-page graph data injected at build time (no runtime fetch)
import { findCard, addCard, reviewCard, masterQuestion } from "./srs"
import {
  incrementLearned,
  incrementReviewed,
  updateStreak,
  loadSettings,
  saveSettings,
} from "./settings"

interface PageGraphData {
  type: "transition" | "submission" | "position"
  name: string
  endingPosition?: string
  endingPositionPath?: string
  isTerminal?: boolean
  knowledgeAssessment: Array<{ question: string; answer: string }>
}

interface JourneyStep {
  slug: string
  name: string
  type: "position" | "transition" | "submission"
  success?: boolean
  action?: "dice-roll" | "flashcard" | "opponent-turn"
  rating?: "again" | "hard" | "easy"
}

function getPageData(): PageGraphData | null {
  const el = document.getElementById("page-graph-data")
  if (!el?.textContent) return null
  try {
    const data = JSON.parse(el.textContent)
    if (data.type === "transition" || data.type === "submission" || data.type === "position")
      return data
    return null
  } catch {
    return null
  }
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
  const pageType = container.dataset.pageType as
    | "transition"
    | "submission"
    | "position"
    | undefined
  if (!pageType) return

  const data = getPageData()
  if (!data || data.type !== pageType) {
    container.style.display = "none"
    return
  }

  const currentPath = window.location.pathname

  if (!data.knowledgeAssessment || data.knowledgeAssessment.length === 0) {
    container.style.display = "none"
    return
  }

  // Check SRS status for this technique
  const srsCard = findCard(data.name)
  const isSRSDue = srsCard && srsCard.nextReview <= new Date().toISOString().slice(0, 10)
  const isMastered = srsCard && srsCard.repetitions >= 5 && srsCard.easeFactor >= 2.5

  // Show the container
  container.style.display = "block"

  // Dismiss/collapse logic
  const flashcardEl = document.getElementById("flashcard")
  const collapsedEl = document.getElementById("flashcard-collapsed")
  const dismissBtn = document.getElementById("flashcard-dismiss-btn")
  const inSession = isInSession()
  const settings = loadSettings()

  if (!settings.showFlashcards && !inSession) {
    if (flashcardEl) flashcardEl.style.display = "none"
    if (collapsedEl) collapsedEl.classList.remove("hidden")
  } else {
    if (flashcardEl) flashcardEl.style.display = ""
    if (collapsedEl) collapsedEl.classList.add("hidden")
  }

  // Hide dismiss button during active training sessions
  if (inSession && dismissBtn) {
    dismissBtn.style.display = "none"
  }

  // Get DOM elements (let — will be reassigned after cloning to strip old listeners)
  const labelEl = document.getElementById("flashcard-label")
  const questionEl = document.getElementById("flashcard-question")
  let answerEl = document.getElementById("flashcard-answer")
  let revealBtn = document.getElementById("reveal-btn")
  let resultBtns = document.getElementById("result-btns")
  let againBtn = document.getElementById("again-btn")
  let hardBtn = document.getElementById("hard-btn")
  let easyBtn = document.getElementById("easy-btn")
  let downvoteBtn = document.getElementById("flashcard-downvote")
  const feedbackEl = document.getElementById("flashcard-feedback")
  let feedbackInput = document.getElementById("feedback-input") as HTMLInputElement | null
  let feedbackSubmit = document.getElementById("feedback-submit")

  if (
    !labelEl ||
    !questionEl ||
    !answerEl ||
    !revealBtn ||
    !resultBtns ||
    !againBtn ||
    !hardBtn ||
    !easyBtn
  ) {
    console.warn("Flashcard elements not found")
    return
  }

  // Track used questions to avoid repeats
  const usedQuestionIndices: Set<number> = new Set()
  let currentQuestionIndex = -1
  let knownCount = 0 // questions answered Hard or Easy

  const totalQuestions = data.knowledgeAssessment.length

  // "Add to Training" button
  let addTrainingBtn = document.getElementById("flashcard-add-training")

  function updateAddTrainingBtn() {
    if (!addTrainingBtn) return
    if (pageType === "position" || findCard(data!.name)) {
      addTrainingBtn.classList.add("hidden")
    } else {
      addTrainingBtn.classList.remove("hidden")
    }
  }

  function handleAddTraining() {
    const techniqueType = pageType === "submission" ? "submission" : "transition"
    addCard(data!.name, techniqueType as "transition" | "submission", currentPath)
    if (addTrainingBtn) addTrainingBtn.classList.add("hidden")
    const showSnackbar = (window as any).showSnackbar
    if (showSnackbar) {
      showSnackbar({ type: "success", message: `${data!.name} added to training` })
    }
  }

  function getRandomQuestion(): { question: string; answer: string; index: number } | null {
    if (!data || !data.knowledgeAssessment) return null

    const availableIndices = data.knowledgeAssessment
      .map((_, i) => i)
      .filter((i) => !usedQuestionIndices.has(i))

    // All questions answered — return null to signal completion
    if (availableIndices.length === 0) {
      return null
    }

    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)]
    usedQuestionIndices.add(randomIndex)

    return {
      ...data.knowledgeAssessment[randomIndex],
      index: randomIndex,
    }
  }

  function showQuestion() {
    // If mastered, skip flashcard — show mastered label briefly
    if (isMastered && pageType !== "position") {
      labelEl!.textContent = "\u2726 Mastered"
      labelEl!.classList.add("flashcard-label-mastered")
      questionEl!.textContent = `${data!.name} — all flashcards mastered!`
      answerEl!.style.display = "none"
      revealBtn!.style.display = "none"
      resultBtns!.style.display = "none"
      if (downvoteBtn) downvoteBtn.style.display = "none"
      // Auto-proceed after short delay
      setTimeout(() => navigateAfterSuccess(), 1200)
      return
    }

    const qa = getRandomQuestion()

    // All questions completed
    if (!qa) {
      const baseLabel = pageType === "position" ? "Position Test" : "Technique Test"
      labelEl!.textContent = `${baseLabel} (${knownCount} known / ${totalQuestions} questions)`
      labelEl!.classList.remove("flashcard-label-srs", "flashcard-label-mastered")
      if (pageType === "position") {
        questionEl!.textContent = "All questions completed! Well done."
        answerEl!.style.display = "none"
        revealBtn!.style.display = "none"
        resultBtns!.style.display = "none"
        if (downvoteBtn) downvoteBtn.style.display = "none"
      }
      return
    }

    currentQuestionIndex = qa.index
    const progressText = `${knownCount} known / ${totalQuestions} questions`

    // Set label based on SRS status
    if (isSRSDue) {
      labelEl!.textContent = `\u2726 SRS Review (${progressText})`
      labelEl!.classList.add("flashcard-label-srs")
      labelEl!.classList.remove("flashcard-label-mastered")
    } else {
      const baseLabel =
        pageType === "position"
          ? "Position Test"
          : pageType === "submission"
            ? "Submission Test"
            : "Technique Test"
      labelEl!.textContent = `${baseLabel} (${progressText})`
      labelEl!.classList.remove("flashcard-label-srs", "flashcard-label-mastered")
    }

    // Show/hide "Add to Training" button
    updateAddTrainingBtn()

    questionEl!.textContent = qa.question
    answerEl!.textContent = qa.answer
    answerEl!.style.display = "none"

    revealBtn!.style.display = "block"
    resultBtns!.style.display = "none"
    if (downvoteBtn) downvoteBtn.style.display = "none"
    if (feedbackEl) feedbackEl.style.display = "none"
    if (feedbackInput) feedbackInput.value = ""
  }

  function revealAnswer() {
    answerEl!.style.display = "block"
    revealBtn!.style.display = "none"
    resultBtns!.style.display = "flex"
    if (downvoteBtn) downvoteBtn.style.display = "inline-flex"

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
    if (downvoteBtn) downvoteBtn.style.display = "none"
  }

  function handleHard() {
    knownCount++

    // Record in journey — this is the FINAL outcome for this question
    addToJourney({
      slug: currentPath,
      name: data!.name,
      type: pageType as "transition" | "submission" | "position",
      success: true,
      action: "flashcard",
      rating: "hard",
    })

    // Add to SRS if not already added, then review
    const techniqueType = pageType === "submission" ? "submission" : "transition"
    if (!findCard(data!.name)) {
      addCard(data!.name, techniqueType as "transition" | "submission", currentPath)
      incrementLearned()
    }
    reviewCard(data!.name, "hard")
    masterQuestion(data!.name, currentQuestionIndex)
    incrementReviewed()
    updateStreak()

    // Hide "Add to Training" since card is now in SRS
    if (addTrainingBtn) addTrainingBtn.classList.add("hidden")

    showSavePromptIfNeeded()
    navigateAfterSuccess()
  }

  function handleEasy() {
    knownCount++

    // Record in journey
    addToJourney({
      slug: currentPath,
      name: data!.name,
      type: pageType as "transition" | "submission" | "position",
      success: true,
      action: "flashcard",
      rating: "easy",
    })

    // Auto-add technique to SRS on first Easy, then review
    const techniqueType = pageType === "submission" ? "submission" : "transition"
    if (!findCard(data!.name)) {
      addCard(data!.name, techniqueType as "transition" | "submission", currentPath)
      incrementLearned()
    }
    reviewCard(data!.name, "easy")
    masterQuestion(data!.name, currentQuestionIndex)
    incrementReviewed()
    updateStreak()

    // Hide "Add to Training" since card is now in SRS
    if (addTrainingBtn) addTrainingBtn.classList.add("hidden")

    showSavePromptIfNeeded()
    navigateAfterSuccess()
  }

  // Training session navigation
  interface SessionQueue {
    pages: Array<{ slug: string; name: string; type: string }>
    currentIndex: number
    completed: number
  }

  function getSession(): SessionQueue | null {
    try {
      const raw = sessionStorage.getItem("training-session")
      if (raw) return JSON.parse(raw) as SessionQueue
    } catch {
      // corrupt
    }
    return null
  }

  function saveSession(session: SessionQueue) {
    sessionStorage.setItem("training-session", JSON.stringify(session))
  }

  function isInSession(): boolean {
    const session = getSession()
    return session !== null && session.pages.length > 0
  }

  function advanceSession() {
    const session = getSession()
    if (!session) return

    const showSnackbar = (window as any).showSnackbar
    session.completed = session.currentIndex + 1

    if (session.currentIndex < session.pages.length - 1) {
      session.currentIndex++
      saveSession(session)
      const next = session.pages[session.currentIndex]
      if (showSnackbar) {
        showSnackbar({
          type: "info",
          message: `Technique ${session.currentIndex + 1}/${session.pages.length}`,
        })
      }
      window.spaNavigate(new URL(next.slug, window.location.toString()), false)
    } else {
      // Session complete — go to dashboard
      sessionStorage.setItem("training-session-complete", "true")
      sessionStorage.removeItem("training-session")
      window.spaNavigate(new URL("/Training", window.location.toString()), false)
    }
  }

  function navigateAfterSuccess() {
    if (pageType === "position") {
      const showSnackbar = (window as any).showSnackbar
      if (showSnackbar) {
        showSnackbar({ type: "success", message: "Correct! Keep practicing." })
      }
      showQuestion()
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

  function handleDownvote() {
    if (feedbackEl) feedbackEl.style.display = "block"
    if (feedbackInput) feedbackInput.focus()
  }

  function handleFeedbackSubmit() {
    const reason = feedbackInput?.value.trim() || ""

    if ((window as any).posthog) {
      const qa = data?.knowledgeAssessment[currentQuestionIndex]
      ;(window as any).posthog.capture("flashcard_downvote", {
        page: currentPath,
        technique: data?.name,
        question: qa?.question,
        reason,
      })
    }

    const showSnackbar = (window as any).showSnackbar
    if (showSnackbar) {
      showSnackbar({ type: "info", message: "Oss" })
    }
    if (feedbackEl) feedbackEl.style.display = "none"
    if (feedbackInput) feedbackInput.value = ""
  }

  function handleFeedbackKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      handleFeedbackSubmit()
    }
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
  if (downvoteBtn) downvoteBtn = freshClone(downvoteBtn)
  if (addTrainingBtn) addTrainingBtn = freshClone(addTrainingBtn)
  if (feedbackSubmit) feedbackSubmit = freshClone(feedbackSubmit)
  feedbackInput = document.getElementById("feedback-input") as HTMLInputElement | null

  revealBtn.addEventListener("click", revealAnswer)
  againBtn.addEventListener("click", handleAgain)
  hardBtn.addEventListener("click", handleHard)
  easyBtn.addEventListener("click", handleEasy)
  if (downvoteBtn) downvoteBtn.addEventListener("click", handleDownvote)
  if (addTrainingBtn) addTrainingBtn.addEventListener("click", handleAddTraining)
  if (feedbackSubmit) feedbackSubmit.addEventListener("click", handleFeedbackSubmit)
  if (feedbackInput) feedbackInput.addEventListener("keydown", handleFeedbackKeydown)

  // Clean up on navigation
  window.addCleanup(() => {
    revealBtn!.removeEventListener("click", revealAnswer)
    againBtn!.removeEventListener("click", handleAgain)
    hardBtn!.removeEventListener("click", handleHard)
    easyBtn!.removeEventListener("click", handleEasy)
    if (downvoteBtn) downvoteBtn.removeEventListener("click", handleDownvote)
    if (addTrainingBtn) addTrainingBtn.removeEventListener("click", handleAddTraining)
    if (feedbackSubmit) feedbackSubmit.removeEventListener("click", handleFeedbackSubmit)
    if (feedbackInput) feedbackInput.removeEventListener("keydown", handleFeedbackKeydown)
  })

  // Dismiss/expand handlers
  function handleDismiss() {
    const s = loadSettings()
    s.showFlashcards = false
    saveSettings(s)
    if (flashcardEl) flashcardEl.style.display = "none"
    // Re-query since original may have been replaced by freshClone
    const collapsed = document.getElementById("flashcard-collapsed")
    if (collapsed) collapsed.classList.remove("hidden")
    const showSnackbar = (window as any).showSnackbar
    if (showSnackbar) {
      showSnackbar({
        type: "info",
        message: "Knowledge Test hidden. Re-enable in Training settings.",
      })
    }
  }

  function handleExpand() {
    const s = loadSettings()
    s.showFlashcards = true
    saveSettings(s)
    if (flashcardEl) flashcardEl.style.display = ""
    const collapsed = document.getElementById("flashcard-collapsed")
    if (collapsed) collapsed.classList.add("hidden")
  }

  let dismissBtnFresh = dismissBtn ? freshClone(dismissBtn) : null
  let collapsedFresh = collapsedEl ? freshClone(collapsedEl) : null

  if (dismissBtnFresh) dismissBtnFresh.addEventListener("click", handleDismiss)
  if (collapsedFresh) collapsedFresh.addEventListener("click", handleExpand)

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

  // Show initial question
  showQuestion()

  window.addCleanup(() => {
    if (dismissBtnFresh) dismissBtnFresh.removeEventListener("click", handleDismiss)
    if (collapsedFresh) collapsedFresh.removeEventListener("click", handleExpand)
  })
})
