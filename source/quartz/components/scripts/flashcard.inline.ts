// Flashcard Knowledge Test - Anki-style recall test for transitions and submissions
// Reads per-page graph data injected at build time (no runtime fetch)

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
  action?: "dice-roll" | "flashcard"
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
    // Hide the flashcard container if no questions available
    container.style.display = "none"
    return
  }

  // Show the container
  container.style.display = "block"

  // For position pages, relocate flashcard into the knowledge-assessment section
  if (pageType === "position") {
    const kaSection = document.getElementById("knowledge-assessment")
    if (kaSection) {
      // Hide static Q&A content, insert flashcard in its place
      for (const child of Array.from(kaSection.children)) {
        if (child.id !== "flashcard-container") {
          ;(child as HTMLElement).style.display = "none"
        }
      }
      kaSection.appendChild(container)
    }
  }

  // Get DOM elements
  const labelEl = document.getElementById("flashcard-label")
  const questionEl = document.getElementById("flashcard-question")
  const answerEl = document.getElementById("flashcard-answer")
  const revealBtn = document.getElementById("reveal-btn")
  const resultBtns = document.getElementById("result-btns")
  const rememberedBtn = document.getElementById("remembered-btn")
  const missedBtn = document.getElementById("missed-btn")
  const downvoteBtn = document.getElementById("flashcard-downvote")
  const feedbackEl = document.getElementById("flashcard-feedback")
  const feedbackInput = document.getElementById("feedback-input") as HTMLInputElement | null
  const feedbackSubmit = document.getElementById("feedback-submit")

  if (
    !labelEl ||
    !questionEl ||
    !answerEl ||
    !revealBtn ||
    !resultBtns ||
    !rememberedBtn ||
    !missedBtn
  ) {
    console.warn("Flashcard elements not found")
    return
  }

  // Track used questions to avoid repeats
  const usedQuestionIndices: Set<number> = new Set()
  let currentQuestionIndex = -1

  function getRandomQuestion(): { question: string; answer: string; index: number } | null {
    if (!data || !data.knowledgeAssessment) return null

    const availableIndices = data.knowledgeAssessment
      .map((_, i) => i)
      .filter((i) => !usedQuestionIndices.has(i))

    if (availableIndices.length === 0) {
      // All questions used, reset
      usedQuestionIndices.clear()
      return getRandomQuestion()
    }

    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)]
    usedQuestionIndices.add(randomIndex)

    return {
      ...data.knowledgeAssessment[randomIndex],
      index: randomIndex,
    }
  }

  function showQuestion() {
    const qa = getRandomQuestion()
    if (!qa) return

    currentQuestionIndex = qa.index

    // Update label
    labelEl!.textContent =
      pageType === "position"
        ? "Position Test"
        : pageType === "submission"
          ? "Submission Test"
          : "Technique Test"

    // Show question, hide answer
    questionEl!.textContent = qa.question
    answerEl!.textContent = qa.answer
    answerEl!.style.display = "none"

    // Show reveal button, hide result buttons and feedback
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

  function handleRemembered() {
    // Add to journey
    addToJourney({
      slug: currentPath,
      name: data!.name,
      type: pageType as "transition" | "submission" | "position",
      success: true,
      action: "flashcard",
    })

    if (pageType === "position") {
      // Stay on page, show success snackbar, and load next question
      const showSnackbar = (window as any).showSnackbar
      if (showSnackbar) {
        showSnackbar({ type: "success", message: "Correct! Keep practicing." })
      }
      showQuestion()
      return
    }

    if (pageType === "submission") {
      // Navigate to game-over terminal state
      navigateToVictory()
    } else {
      // Transition - navigate to ending position
      navigateToEndingPosition()
    }
  }

  function handleMissed() {
    // Show failure snackbar
    const showSnackbar = (window as any).showSnackbar
    if (showSnackbar) {
      showSnackbar({
        type: "failure",
        message: "Keep studying! Try another question.",
      })
    }

    // Add to journey as failed attempt
    addToJourney({
      slug: currentPath,
      name: data!.name,
      type: pageType as "transition" | "submission" | "position",
      success: false,
      action: "flashcard",
    })

    // Show another question
    showQuestion()
  }

  function navigateToEndingPosition() {
    if (!data || !data.endingPosition) return

    // Build URL using endingPositionPath if available
    // endingPosition format: "mount/top" or "standing-position"
    // endingPositionPath format: "mount" or "half-guard/deep-half-guard"
    let targetUrl: string

    const endingSlug = data.endingPosition
    // endingPositionPath from graph.json is already case-correct for URLs
    const basePath = data.endingPositionPath || endingSlug.split("/")[0]

    // Extract role from endingPosition if present (e.g., "mount/top" → "top")
    const slugParts = endingSlug.split("/")
    const role = slugParts.length > 1 ? slugParts[slugParts.length - 1] : null

    if (role === "top" || role === "bottom") {
      // Add role suffix: /Positions/Mount/Top
      targetUrl = `/Positions/${basePath}/${role.charAt(0).toUpperCase() + role.slice(1)}`
    } else {
      // Neutral position: /Positions/Standing-Position
      targetUrl = `/Positions/${basePath}`
    }

    // Set success snackbar for next page
    sessionStorage.setItem(
      "snackbar",
      JSON.stringify({
        type: "success",
        message: `${data.name} executed successfully!`,
        from: currentPath,
      }),
    )

    // Navigate
    window.spaNavigate(new URL(targetUrl, window.location.toString()), false)
  }

  function navigateToVictory() {
    // Store journey data for the victory page to display
    const journey = getJourney()
    sessionStorage.setItem(
      "victory-data",
      JSON.stringify({
        submissionName: data!.name,
        journey: journey,
      }),
    )

    // Set success snackbar for next page
    sessionStorage.setItem(
      "snackbar",
      JSON.stringify({
        type: "success",
        message: `Victory by ${data!.name}!`,
        from: currentPath,
      }),
    )

    // Navigate to Game Over page
    window.spaNavigate(new URL("/Game-Over", window.location.toString()), false)
  }

  function handleDownvote() {
    if (feedbackEl) feedbackEl.style.display = "block"
    if (feedbackInput) feedbackInput.focus()
  }

  function handleFeedbackSubmit() {
    const reason = feedbackInput?.value.trim() || ""

    // Track to PostHog
    if ((window as any).posthog) {
      const qa = data?.knowledgeAssessment[currentQuestionIndex]
      ;(window as any).posthog.capture("flashcard_downvote", {
        page: currentPath,
        technique: data?.name,
        question: qa?.question,
        reason,
      })
    }

    // Show toast and reset
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

  // Set up event listeners
  revealBtn.addEventListener("click", revealAnswer)
  rememberedBtn.addEventListener("click", handleRemembered)
  missedBtn.addEventListener("click", handleMissed)
  if (downvoteBtn) downvoteBtn.addEventListener("click", handleDownvote)
  if (feedbackSubmit) feedbackSubmit.addEventListener("click", handleFeedbackSubmit)
  if (feedbackInput) feedbackInput.addEventListener("keydown", handleFeedbackKeydown)

  // Clean up on navigation
  window.addCleanup(() => {
    revealBtn.removeEventListener("click", revealAnswer)
    rememberedBtn.removeEventListener("click", handleRemembered)
    missedBtn.removeEventListener("click", handleMissed)
    if (downvoteBtn) downvoteBtn.removeEventListener("click", handleDownvote)
    if (feedbackSubmit) feedbackSubmit.removeEventListener("click", handleFeedbackSubmit)
    if (feedbackInput) feedbackInput.removeEventListener("keydown", handleFeedbackKeydown)
  })

  // Show initial question
  showQuestion()
})
