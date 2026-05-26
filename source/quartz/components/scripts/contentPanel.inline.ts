// Content Panel — JS-driven state machine for graph ↔ content toggle.
// Two states: content (normal view, graph peeks 60px above) ↔ graph (full graph, title peeks ~50px at bottom).
// Toggle via wheel intent (40px / 200ms), touch drag, Ctrl+G, Escape, or button.

// Graph mode shows full graph but the page title always peeks at the bottom
const GRAPH_PEEK_PX = 50
// Content mode: card offset slightly so graph peeks above
const INITIAL_PEEK_PX = 60
// Wheel intent: accumulated |deltaY| within a rolling window commits the snap.
// One normal mouse-wheel click (~100px) clears WHEEL_INTENT_PX in a single event.
const WHEEL_INTENT_PX = 40
const WHEEL_INTENT_WINDOW_MS = 200
// Sub-threshold wheel feedback — only fired for meaningful events to avoid
// twitch-rubber-banding on small trackpad deltas (which accumulate silently).
const WHEEL_RUBBERBAND_MIN_DELTA = 20
const WHEEL_RUBBERBAND_PX = 16
// Touch drag: 1:1 finger tracking up to 30%, soft resistance past that.
const TOUCH_RUBBERBAND_THRESHOLD = 0.3
// Symmetric commit threshold for touch drag (fraction of viewport).
const TOUCH_COMMIT_THRESHOLD = 0.2

// Motion curves
const FORWARD_TRANSITION = "transform 450ms cubic-bezier(0.34, 1.56, 0.64, 1)"
const REVERSE_TRANSITION = "transform 380ms cubic-bezier(0.4, 0, 0.2, 1)"
const OVERLAY_FADE_OUT = "opacity 200ms ease-out"
const OVERLAY_FADE_IN = "opacity 180ms ease-out 80ms"

type PanelState = "content" | "dragging" | "graph"
let state: PanelState = "content"
let dragProgress = 0 // 0 = content, 1 = graph (touch path only)
// Tracks which state the user was in when touch-dragging started, for direction-aware release.
let dragStartedFrom: PanelState | null = null

// Exposed for backgroundGraph.inline.ts via (window as any).__snapToContent / __snapToGraph

function getGraphProgress(): number {
  // Graph position as a fraction of viewport
  return (window.innerHeight - GRAPH_PEEK_PX) / window.innerHeight
}

document.addEventListener("nav", () => {
  state = "content"
  const initProg = INITIAL_PEEK_PX / window.innerHeight
  dragProgress = initProg
  dragStartedFrom = null

  // Home page: ContentPanel is hidden (see custom.scss). Skip wiring its
  // wheel/touch/keyboard handlers so they don't hijack normal scroll.
  if (document.body.dataset.slug === "index") {
    const homePage = document.getElementById("quartz-root") as HTMLElement | null
    const homeOverlay = document.getElementById("graph-overlay") as HTMLElement | null
    if (homePage) {
      homePage.style.transition = "none"
      homePage.style.transform = ""
    }
    if (homeOverlay) homeOverlay.style.opacity = "0"
    document.body.classList.remove("graph-focused")
    return
  }

  const page = document.getElementById("quartz-root") as HTMLElement
  const overlay = document.getElementById("graph-overlay") as HTMLElement
  const toggleBtn = document.getElementById("panel-toggle") as HTMLElement
  if (!page || !overlay) return

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

  // Apply initial state: content card offset 60px so graph peeks above. No
  // transition on init — each subsequent snap/drag sets its own transition.
  page.style.transition = "none"
  page.style.transform = `translateY(${INITIAL_PEEK_PX}px)`
  overlay.style.transition = "none"
  overlay.style.opacity = String(1 - initProg)
  document.body.classList.remove("graph-focused")

  // Wheel intent accumulator (rolling window).
  let wheelIntentAccum = 0
  let wheelIntentDir: "up" | "down" | null = null
  let wheelIntentLastTime = 0

  // Rubber-band gate (prevents stacking sub-threshold feedback animations).
  let rubberBandTimer1: ReturnType<typeof setTimeout> | null = null
  let rubberBandTimer2: ReturnType<typeof setTimeout> | null = null

  function clearRubberBandTimers() {
    if (rubberBandTimer1) {
      clearTimeout(rubberBandTimer1)
      rubberBandTimer1 = null
    }
    if (rubberBandTimer2) {
      clearTimeout(rubberBandTimer2)
      rubberBandTimer2 = null
    }
  }

  function rubberBand(direction: "down" | "up") {
    if (reducedMotion) return
    if (state === "dragging") return
    if (rubberBandTimer1 || rubberBandTimer2) return
    const baseY = state === "content" ? INITIAL_PEEK_PX : window.innerHeight - GRAPH_PEEK_PX
    const offset = direction === "down" ? WHEEL_RUBBERBAND_PX : -WHEEL_RUBBERBAND_PX
    page.style.transition = "transform 120ms ease-out"
    page.style.transform = `translateY(${baseY + offset}px)`
    rubberBandTimer1 = setTimeout(() => {
      rubberBandTimer1 = null
      page.style.transition = "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)"
      page.style.transform = `translateY(${baseY}px)`
      rubberBandTimer2 = setTimeout(() => {
        rubberBandTimer2 = null
      }, 200)
    }, 120)
  }

  // Soft rubber-band for touch drag: 1:1 up to 30%, decaying past.
  function softResist(raw: number): number {
    if (raw <= TOUCH_RUBBERBAND_THRESHOLD) return raw
    return TOUCH_RUBBERBAND_THRESHOLD + (raw - TOUCH_RUBBERBAND_THRESHOLD) * 0.5
  }

  // --- Transform (touch drag only) ---
  function applyTransform(progress: number) {
    page.style.transform = `translateY(${progress * 100}vh)`
    overlay.style.opacity = String(1 - progress)
    if (toggleBtn) {
      toggleBtn.setAttribute("aria-label", progress > 0.5 ? "Show content" : "Show graph")
    }
  }

  // --- Snap to graph (title always peeks at bottom) ---
  function snapToGraph() {
    clearRubberBandTimers()
    const graphProg = getGraphProgress()
    state = "graph"
    dragProgress = graphProg
    if (reducedMotion) {
      page.style.transition = "none"
      overlay.style.transition = "opacity 150ms linear"
    } else {
      page.style.transition = FORWARD_TRANSITION
      overlay.style.transition = OVERLAY_FADE_OUT
    }
    page.style.transform = `translateY(calc(100vh - ${GRAPH_PEEK_PX}px))`
    overlay.style.opacity = "0"
    document.body.classList.add("graph-focused")
    if (toggleBtn) toggleBtn.setAttribute("aria-label", "Show content")
    // Trigger first-reveal zoom-out animation (10x → fit-all)
    const reveal = (window as any).__zoomOutReveal
    if (reveal) reveal()
  }

  function snapToContent() {
    clearRubberBandTimers()
    state = "content"
    const initProg = INITIAL_PEEK_PX / window.innerHeight
    dragProgress = initProg
    if (reducedMotion) {
      page.style.transition = "none"
      overlay.style.transition = "opacity 150ms linear"
    } else {
      page.style.transition = REVERSE_TRANSITION
      overlay.style.transition = OVERLAY_FADE_IN
    }
    page.style.transform = `translateY(${INITIAL_PEEK_PX}px)`
    overlay.style.opacity = String(1 - initProg)
    document.body.classList.remove("graph-focused")
    if (toggleBtn) toggleBtn.setAttribute("aria-label", "Show graph")
  }

  // Expose globally
  ;(window as any).__snapToContent = snapToContent
  ;(window as any).__snapToGraph = snapToGraph

  // --- Wheel handler (intent-commit, no drag-coupling) ---
  function onWheel(e: WheelEvent) {
    const now = performance.now()
    const dir: "up" | "down" = e.deltaY < 0 ? "up" : "down"

    // Reset accumulator on direction change or window expiry.
    if (wheelIntentDir !== dir || now - wheelIntentLastTime > WHEEL_INTENT_WINDOW_MS) {
      wheelIntentAccum = 0
      wheelIntentDir = dir
    }
    wheelIntentLastTime = now

    // Content → graph: scroll up at top of article.
    if (state === "content" && window.scrollY <= 0 && dir === "up") {
      e.preventDefault()
      wheelIntentAccum += Math.abs(e.deltaY)
      if (wheelIntentAccum >= WHEEL_INTENT_PX) {
        wheelIntentAccum = 0
        snapToGraph()
      } else if (Math.abs(e.deltaY) >= WHEEL_RUBBERBAND_MIN_DELTA) {
        rubberBand("down")
      }
      return
    }

    // Graph → content: scroll down. Excess motion past the commit threshold
    // spills into body scroll so a big swipe transitions AND scrolls in one motion.
    if (state === "graph" && dir === "down") {
      e.preventDefault()
      wheelIntentAccum += Math.abs(e.deltaY)
      if (wheelIntentAccum >= WHEEL_INTENT_PX) {
        const excess = wheelIntentAccum - WHEEL_INTENT_PX
        wheelIntentAccum = 0
        snapToContent()
        if (excess > 0) {
          window.scrollBy({ top: excess, behavior: "auto" })
        }
      } else if (Math.abs(e.deltaY) >= WHEEL_RUBBERBAND_MIN_DELTA) {
        rubberBand("up")
      }
      return
    }

    // Graph → content via overscroll: at min zoom, scroll up dismisses (same intent rule).
    if (state === "graph" && dir === "up") {
      const isAtMinZoom = (window as any).__isGraphAtMinZoom
      if (isAtMinZoom && isAtMinZoom()) {
        e.preventDefault()
        wheelIntentAccum += Math.abs(e.deltaY)
        if (wheelIntentAccum >= WHEEL_INTENT_PX) {
          wheelIntentAccum = 0
          snapToContent()
        }
      }
    }
  }

  // --- Touch handlers (1:1 finger tracking with rubber-band resistance) ---
  let touchStartY = 0
  let touchStartScrollY = 0

  function onTouchStart(e: TouchEvent) {
    touchStartY = e.touches[0].clientY
    touchStartScrollY = window.scrollY
  }

  function onTouchMove(e: TouchEvent) {
    const currentY = e.touches[0].clientY
    const deltaY = touchStartY - currentY // positive = finger moved up

    if (state === "content" && touchStartScrollY <= 0 && deltaY < 0) {
      // Start drag from content (finger moved down at top of page)
      e.preventDefault()
      dragStartedFrom = "content"
      state = "dragging"
      page.style.transition = "none"
      overlay.style.transition = "none"
      const rawMovement = Math.min(1, Math.abs(deltaY) / window.innerHeight)
      dragProgress = softResist(rawMovement)
      applyTransform(dragProgress)
    } else if (state === "dragging") {
      e.preventDefault()
      const totalDelta = touchStartY - currentY // positive = finger up
      let rawMovement: number
      if (dragStartedFrom === "graph") {
        // From graph: finger up = movement toward content (upward).
        rawMovement = Math.max(0, Math.min(1, totalDelta / window.innerHeight))
      } else {
        // From content: finger down (totalDelta < 0) = movement toward graph.
        rawMovement = Math.max(0, Math.min(1, -totalDelta / window.innerHeight))
      }
      const resisted = softResist(rawMovement)
      if (dragStartedFrom === "graph") {
        const graphProg = getGraphProgress()
        dragProgress = Math.max(0, graphProg - resisted)
      } else {
        dragProgress = resisted
      }
      applyTransform(dragProgress)
    } else if (state === "graph" && deltaY > 0) {
      // Start drag from graph (finger swipes up)
      e.preventDefault()
      dragStartedFrom = "graph"
      state = "dragging"
      page.style.transition = "none"
      overlay.style.transition = "none"
      const graphProg = getGraphProgress()
      const rawMovement = Math.min(1, deltaY / window.innerHeight)
      dragProgress = Math.max(0, graphProg - softResist(rawMovement))
      applyTransform(dragProgress)
    } else if (state === "graph" && deltaY < 0) {
      // Touch overscroll at min zoom: finger swipe down → dismiss (reuses wheel intent rule).
      const isAtMinZoom = (window as any).__isGraphAtMinZoom
      if (isAtMinZoom && isAtMinZoom()) {
        wheelIntentAccum += Math.abs(deltaY)
        if (wheelIntentAccum >= WHEEL_INTENT_PX) {
          wheelIntentAccum = 0
          snapToContent()
        }
      }
    }
  }

  function onTouchEnd() {
    wheelIntentAccum = 0
    onRelease()
  }

  // --- Touch release: symmetric 20%-of-viewport commit in both directions ---
  function onRelease() {
    if (state !== "dragging") return
    const graphProg = getGraphProgress()
    if (dragStartedFrom === "graph") {
      // Moved down by at least TOUCH_COMMIT_THRESHOLD of viewport → commit to content.
      if (dragProgress < graphProg - TOUCH_COMMIT_THRESHOLD) {
        snapToContent()
      } else {
        snapToGraph()
      }
    } else {
      // Moved up by at least TOUCH_COMMIT_THRESHOLD of viewport → commit to graph.
      if (dragProgress > TOUCH_COMMIT_THRESHOLD) {
        snapToGraph()
      } else {
        snapToContent()
      }
    }
    dragStartedFrom = null
  }

  // --- Keyboard shortcuts ---
  function onKeydown(e: KeyboardEvent) {
    if (e.key === "g" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault()
      state === "graph" ? snapToContent() : snapToGraph()
    }
    if (e.key === "Escape" && state === "graph") {
      e.preventDefault()
      snapToContent()
    }
  }

  // --- Button click ---
  function onToggleClick() {
    state === "graph" ? snapToContent() : snapToGraph()
  }

  // --- Top-stripe click: tapping the bar above the drawer (anywhere except the
  // 5 buttons that live in it) does the same thing as the chevron expand button.
  // The strip is the area y < INITIAL_PEEK_PX (60px) where the graph peeks
  // above the content card in content mode.
  const TOP_STRIPE_BTN_SELECTOR =
    "#tree-toggle, #search-button, #flashcards-header, #roll-session-btn, #panel-toggle, #topbar-auth, #graph-close-btn, #fit-all-btn"
  function onTopStripeClick(e: MouseEvent) {
    if (state !== "content") return
    if (e.clientY >= INITIAL_PEEK_PX) return
    const target = e.target as HTMLElement | null
    if (!target) return
    if (target.closest(TOP_STRIPE_BTN_SELECTOR)) return
    snapToGraph()
  }

  // --- Register events ---
  window.addEventListener("wheel", onWheel, { passive: false })
  window.addEventListener("touchstart", onTouchStart, { passive: true })
  window.addEventListener("touchmove", onTouchMove, { passive: false })
  window.addEventListener("touchend", onTouchEnd)
  document.addEventListener("keydown", onKeydown)
  document.addEventListener("click", onTopStripeClick)
  toggleBtn?.addEventListener("click", onToggleClick)

  if (reducedMotion) {
    overlay.style.backdropFilter = "none"
    ;(overlay.style as any).webkitBackdropFilter = "none"
  }

  window.addCleanup(() => {
    window.removeEventListener("wheel", onWheel)
    window.removeEventListener("touchstart", onTouchStart)
    window.removeEventListener("touchmove", onTouchMove)
    window.removeEventListener("touchend", onTouchEnd)
    document.removeEventListener("keydown", onKeydown)
    document.removeEventListener("click", onTopStripeClick)
    toggleBtn?.removeEventListener("click", onToggleClick)
    clearRubberBandTimers()
  })
})
