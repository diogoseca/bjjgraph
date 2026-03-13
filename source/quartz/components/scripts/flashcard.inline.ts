// Flashcard Knowledge Test - Anki-style 3-button model (Again/Hard/Easy) with SRS
// Reads per-page graph data injected at build time (no runtime fetch)
import { findCard, addCard, reviewCard } from "./srs"

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

  // For position pages, keep flashcard in beforeBody (after move cards)
  // and hide the knowledge-assessment section in the article to avoid duplication
  if (pageType === "position") {
    const kaSection = document.getElementById("knowledge-assessment")
    if (kaSection) {
      ;(kaSection as HTMLElement).style.display = "none"
    }
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

  const totalQuestions = data.knowledgeAssessment.length

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
      const progressText = `${totalQuestions}/${totalQuestions}`
      if (pageType === "position") {
        labelEl!.textContent = `Position Test (${progressText})`
        labelEl!.classList.remove("flashcard-label-srs", "flashcard-label-mastered")
        questionEl!.textContent = "All questions completed! Well done."
        answerEl!.style.display = "none"
        revealBtn!.style.display = "none"
        resultBtns!.style.display = "none"
        if (downvoteBtn) downvoteBtn.style.display = "none"
      }
      return
    }

    currentQuestionIndex = qa.index
    const progressText = `${usedQuestionIndices.size}/${totalQuestions}`

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
  }

  function handleAgain() {
    // Update SRS if card exists
    const card = findCard(data!.name)
    if (card) {
      reviewCard(data!.name, "again")
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
    // Record in journey — this is the FINAL outcome for this question
    addToJourney({
      slug: currentPath,
      name: data!.name,
      type: pageType as "transition" | "submission" | "position",
      success: true,
      action: "flashcard",
      rating: "hard",
    })

    // Update SRS if card exists
    const card = findCard(data!.name)
    if (card) {
      reviewCard(data!.name, "hard")
    }

    navigateAfterSuccess()
  }

  function handleEasy() {
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
    }
    reviewCard(data!.name, "easy")

    navigateAfterSuccess()
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
  if (feedbackSubmit) feedbackSubmit = freshClone(feedbackSubmit)
  feedbackInput = document.getElementById("feedback-input") as HTMLInputElement | null

  revealBtn.addEventListener("click", revealAnswer)
  againBtn.addEventListener("click", handleAgain)
  hardBtn.addEventListener("click", handleHard)
  easyBtn.addEventListener("click", handleEasy)
  if (downvoteBtn) downvoteBtn.addEventListener("click", handleDownvote)
  if (feedbackSubmit) feedbackSubmit.addEventListener("click", handleFeedbackSubmit)
  if (feedbackInput) feedbackInput.addEventListener("keydown", handleFeedbackKeydown)

  // Clean up on navigation
  window.addCleanup(() => {
    revealBtn!.removeEventListener("click", revealAnswer)
    againBtn!.removeEventListener("click", handleAgain)
    hardBtn!.removeEventListener("click", handleHard)
    easyBtn!.removeEventListener("click", handleEasy)
    if (downvoteBtn) downvoteBtn.removeEventListener("click", handleDownvote)
    if (feedbackSubmit) feedbackSubmit.removeEventListener("click", handleFeedbackSubmit)
    if (feedbackInput) feedbackInput.removeEventListener("keydown", handleFeedbackKeydown)
  })

  // Show initial question
  showQuestion()
})
